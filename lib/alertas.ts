import { db } from "./supabase";
import { resolverReferencia, juzgar } from "./precio";
import { enviarAlerta, esc } from "./telegram";
import { personajes } from "./personajes";

type Row = { id: number; external_id: string; platform: string; title: string; price: number; currency: string; url: string; photo_url: string | null; personaje_id: string; tipo: string; tamano: string | null; certificados: string[] };

const PLAT: Record<string, string> = { vinted: "Vinted", ebay: "eBay", wallapop: "Wallapop" };
const eur = (n: number, c = "EUR") => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${c === "EUR" ? "€" : c}`;

// Alerta de un anuncio NUEVO y certificado: chollo si hay referencia y descuento.
export async function alertar(l: Row) {
  const ref = await resolverReferencia(l.personaje_id, l.tipo, l.external_id);
  const j = juzgar(Number(l.price), ref);
  const nombre = personajes().find((p) => p.id === l.personaje_id)?.nombre ?? l.personaje_id;

  const { data: deal, error } = await db().from("deals").insert({
    listing_id: l.id, external_id: l.external_id, price: l.price,
    ref_price: ref?.precio ?? null, ref_source: ref?.fuente ?? null, ref_level: ref?.nivel ?? null,
    ref_sample: ref?.muestra ?? null, ref_comps: ref?.comps ?? null, descuento: j.descuento,
    es_chollo: j.esChollo, photo_url: l.photo_url,
  }).select("id").single();
  if (error || !deal) return; // ya alertado (external_id único)

  const cab = j.esChollo ? `🔥 <b>CHOLLO −${j.descuento}%</b>` : "🆕 <b>Nuevo con certificado</b>";
  const lineas = [
    cab,
    `<b>${esc(nombre)}</b> · ${esc(l.tipo)}${l.tamano ? " " + l.tamano : ""} · ${esc(l.certificados.join(", "))}`,
    esc(l.title),
    `💶 <b>${eur(Number(l.price), l.currency)}</b> en ${PLAT[l.platform] ?? l.platform}`,
  ];
  if (ref) {
    lineas.push(`📊 Referencia: ${eur(ref.precio)} (${ref.fuente === "vinted_sold" ? "ventas Vinted" : "eBay en venta"}, ${ref.muestra} muestras${ref.nivel > 1 ? ", tipo parecido" : ""})`);
    for (const c of ref.comps.slice(0, 4))
      lineas.push(c.url ? `• <a href="${esc(c.url)}">${eur(c.price)}</a> ${esc(c.title.slice(0, 50))}` : `• ${eur(c.price)} ${esc(c.title.slice(0, 50))}`);
  } else {
    lineas.push("📊 Sin referencia fiable todavía.");
  }
  if (j.aviso) lineas.push(`⚠️ ${esc(j.aviso)}`);

  const msgId = await enviarAlerta({ foto: l.photo_url, html: lineas.join("\n"), url: l.url, dealId: deal.id });
  if (msgId) await db().from("deals").update({ telegram_msg_id: msgId }).eq("id", deal.id);
}
