import { enlace } from "./enlaces";
import { db } from "./supabase";
import { referenciaCarta, resolverReferencia, juzgar } from "./precio";
import { enviarAlerta, esc } from "./telegram";
import { jugadores, nombreDe } from "./personajes";
import type { Interes } from "./ingesta";
import { vendedorBloqueado } from "./votos";
import { FUENTE } from "./precio";
import { descartarPorIA, resumenIA, revisar } from "./ia";
import { fichaEbay } from "./ebay";
import { guardarReevaluacion, reevaluar } from "./descripciones";

type Row = { id: number; external_id: string; platform: string; seller?: string | null; descripcion?: string | null; title: string; price: number; currency: string; url: string; photo_url: string | null; personaje_id: string; tipo: string; tamano: string | null; certificados: string[];
  kind?: string | null; carta_clave?: string | null; carta_desc?: string | null; interes?: Interes };

// Wallapop da favoritos, visitas y conversaciones en la ficha. Solo se consulta para los chollos (pocas llamadas).
async function interesDe(l: Row): Promise<Interes | null> {
  if (l.interes) return l.interes;
  if (l.platform !== "wallapop") return null;
  try {
    const r = await fetch(`https://api.wallapop.com/api/v3/items/${l.external_id.replace(/^wallapop:/, "")}`, {
      headers: { "user-agent": "Mozilla/5.0", "x-deviceos": "0", accept: "application/json" }, signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const c = ((await r.json()) as { counters?: { favorites?: number; views?: number; conversations?: number } }).counters;
    return c ? { likes: c.favorites, vistas: c.views, chats: c.conversations } : null;
  } catch { return null; }
}
function lineaInteres(i: Interes | null): string | null {
  if (!i) return null;
  const partes = [
    i.likes != null ? `❤️ ${i.likes} ${i.likes === 1 ? "favorito" : "favoritos"}` : null,
    i.vistas != null ? `👁️ ${i.vistas} visitas` : null,
    i.chats != null ? `💬 ${i.chats} ${i.chats === 1 ? "conversación" : "conversaciones"}` : null,
  ].filter(Boolean);
  if (!partes.length) return null;
  const caliente = (i.likes ?? 0) >= 10 || (i.chats ?? 0) >= 3;
  return `${partes.join(" · ")}${caliente ? " — <b>mucho interés, decide rápido</b>" : ""}`;
}

const PLAT: Record<string, string> = { vinted: "Vinted", ebay: "eBay", wallapop: "Wallapop", etsy: "Etsy", catawiki: "Catawiki" };
const eur = (n: number, c = "EUR") => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${c === "EUR" ? "€" : c}`;

// Alerta de un anuncio NUEVO y certificado: chollo si hay referencia y descuento.
export async function alertar(l: Row) {
  if (await vendedorBloqueado(l.platform, l.seller)) return;
  const esCarta = l.kind === "carta" && !!l.carta_clave;
  const ref = esCarta ? await referenciaCarta(l.carta_clave!, l.external_id, l.seller) : await resolverReferencia(l.personaje_id, l.tipo, l.external_id, l.seller);
  let j = juzgar(Number(l.price), ref);

  // eBay: antes de avisar de un chollo, leer la descripción del anuncio (cuesta una consulta, solo en candidatos).
  if (j.esChollo && l.platform === "ebay" && !l.descripcion) {
    const f = await fichaEbay(l.external_id.replace(/^ebay:/, ""), "EBAY_US").catch(() => null);
    const fj = (f?.json ?? {}) as { shortDescription?: string; description?: string };
    const desc = [fj.shortDescription, fj.description].filter(Boolean).join("\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
    if (desc) {
      const ev = reevaluar({ kind: l.kind, title: l.title }, desc);
      await guardarReevaluacion(l.id, ev);
      if (ev.descartar || (!esCarta && !ev.certificado)) j = { ...j, esChollo: false, aviso: `Descartado al leer la descripción: ${ev.motivo ?? "sin certificado reconocido"}` };
    }
  }
  const nombre = esCarta ? (jugadores().find((p) => p.id === l.personaje_id)?.nombre ?? l.personaje_id) : nombreDe(l.personaje_id);

  // Segunda opinión de la IA (si está activada), solo para los posibles chollos: foto + descripción.
  const ia = !j.esChollo || esCarta ? null : await revisar({
    titulo: l.title, descripcion: l.descripcion, precio: Number(l.price), plataforma: PLAT[l.platform] ?? l.platform,
    personaje: nombre, certificados: l.certificados, foto: l.photo_url, referencia: ref?.precio ?? null,
  });
  const descartada = descartarPorIA(ia);

  const fila = {
    listing_id: l.id, external_id: l.external_id, price: l.price,
    ref_price: ref?.precio ?? null, ref_source: ref?.fuente ?? null, ref_level: ref?.nivel ?? null,
    ref_sample: ref?.muestra ?? null, ref_comps: ref?.comps ?? null, descuento: j.descuento,
    es_chollo: j.esChollo && !descartada, photo_url: l.photo_url,
  };
  let { data: deal, error } = await db().from("deals").insert({ ...fila, ia, ia_descartado: descartada }).select("id").single();
  if (error && /ia/.test(error.message) && !/duplicate|unique/.test(error.message))
    ({ data: deal, error } = await db().from("deals").insert(fila).select("id").single()); // migración 003 pendiente
  if (error || !deal) return; // ya alertado (external_id único)
  if (descartada) return; // la IA lo ve claro: no molestar (queda en Chollos → Descartados)
  // Telegram solo para chollos de verdad. Las novedades se quedan en la web + resumen diario.
  // (ALERTAS_TELEGRAM=todo vuelve al comportamiento anterior.)
  if (!j.esChollo && process.env.ALERTAS_TELEGRAM !== "todo") return;

  const cab = j.esChollo ? `🔥 <b>CHOLLO −${j.descuento}%</b>${esCarta ? " 🃏" : ""}` : esCarta ? "🆕 <b>Carta nueva</b>" : "🆕 <b>Nuevo con certificado</b>";
  const lineas = [
    cab,
    esCarta ? `<b>${esc(l.carta_desc ?? nombre)}</b>` : `<b>${esc(nombre)}</b> · ${esc(l.tipo)}${l.tamano ? " " + l.tamano : ""} · ${esc(l.certificados.join(", "))}`,
    esc(l.title),
    `💶 Precio: <b>${eur(Number(l.price), l.currency)}</b> en ${PLAT[l.platform] ?? l.platform}`,
  ];
  const interes = lineaInteres(await interesDe(l));
  if (interes) lineas.push(interes);
  if (ref) {
    const dif = Number(ref.precio) - Number(l.price);
    const que = esCarta ? "de esta misma carta" : "de piezas parecidas";
    lineas.push(
      dif >= 0
        ? `📉 <b>${j.descuento}% por DEBAJO del mercado</b> · te ahorras ~${eur(dif)}`
        : `📈 <b>${-(j.descuento ?? 0)}% por ENCIMA del mercado</b>`,
      ref.fuente === "en_venta"
        ? `📊 Mercado: ~<b>${eur(ref.precio)}</b> (lo más barato que piden otros ${ref.muestra} vendedores ${que}; aún no hay ventas registradas):`
        : `📊 Mercado: ~<b>${eur(ref.precio)}</b> (mediana de ${ref.muestra} ${FUENTE[ref.fuente]} ${que}${ref.nivel > 1 ? ", tipo parecido" : ""}):`,
    );
    for (const c of ref.comps.slice(0, 4))
      lineas.push(c.url ? `   • <a href="${esc(enlace(c.url))}">${eur(c.price)}</a> ${esc(c.title.slice(0, 45))}` : `   • ${eur(c.price)} ${esc(c.title.slice(0, 45))}`);
  } else {
    lineas.push("📊 Sin datos de mercado todavía: no sé si es buen precio.");
  }
  if (j.aviso) lineas.push(`⚠️ ${esc(j.aviso)}`);
  if (ia) lineas.push(esc(resumenIA(ia)));

  const msgId = await enviarAlerta({ foto: l.photo_url, html: lineas.join("\n"), url: enlace(l.url), dealId: deal.id });
  if (msgId) await db().from("deals").update({ telegram_msg_id: msgId }).eq("id", deal.id);
}
