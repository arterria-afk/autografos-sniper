import { db } from "./supabase";
import { referenciaCarta, resolverReferencia, juzgar } from "./precio";
import { enviarAlerta, esc } from "./telegram";
import { jugadores, personajes } from "./personajes";
import { vendedorBloqueado } from "./votos";
import { FUENTE } from "./precio";
import { descartarPorIA, resumenIA, revisar } from "./ia";

type Row = { id: number; external_id: string; platform: string; seller?: string | null; descripcion?: string | null; title: string; price: number; currency: string; url: string; photo_url: string | null; personaje_id: string; tipo: string; tamano: string | null; certificados: string[];
  kind?: string; carta_clave?: string | null; carta_desc?: string | null };

const PLAT: Record<string, string> = { vinted: "Vinted", ebay: "eBay", wallapop: "Wallapop", etsy: "Etsy", catawiki: "Catawiki" };
const eur = (n: number, c = "EUR") => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${c === "EUR" ? "€" : c}`;

// Alerta de un anuncio NUEVO y certificado: chollo si hay referencia y descuento.
export async function alertar(l: Row) {
  if (await vendedorBloqueado(l.platform, l.seller)) return;
  const esCarta = l.kind === "carta" && !!l.carta_clave;
  const ref = esCarta ? await referenciaCarta(l.carta_clave!, l.external_id) : await resolverReferencia(l.personaje_id, l.tipo, l.external_id);
  const j = juzgar(Number(l.price), ref);
  const nombre = (esCarta ? jugadores() : personajes()).find((p) => p.id === l.personaje_id)?.nombre ?? l.personaje_id;

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
    `💶 <b>${eur(Number(l.price), l.currency)}</b> en ${PLAT[l.platform] ?? l.platform}`,
  ];
  if (ref) {
    lineas.push(`📊 Referencia: ${eur(ref.precio)} (${FUENTE[ref.fuente]}, ${ref.muestra} muestras${ref.nivel > 1 ? ", tipo parecido" : ""})`);
    for (const c of ref.comps.slice(0, 4))
      lineas.push(c.url ? `• <a href="${esc(c.url)}">${eur(c.price)}</a> ${esc(c.title.slice(0, 50))}` : `• ${eur(c.price)} ${esc(c.title.slice(0, 50))}`);
  } else {
    lineas.push("📊 Sin referencia fiable todavía.");
  }
  if (j.aviso) lineas.push(`⚠️ ${esc(j.aviso)}`);
  if (ia) lineas.push(esc(resumenIA(ia)));

  const msgId = await enviarAlerta({ foto: l.photo_url, html: lineas.join("\n"), url: l.url, dealId: deal.id });
  if (msgId) await db().from("deals").update({ telegram_msg_id: msgId }).eq("id", deal.id);
}
