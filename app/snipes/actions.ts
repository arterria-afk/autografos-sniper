"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gixenActivo, listar, mensajeError, programar, quitar } from "@/lib/gixen";
import { db } from "@/lib/supabase";
import { reconocer } from "@/lib/recognize";
import { personajes } from "@/lib/personajes";

// Acepta una URL de eBay (cualquier país) o el número de artículo a secas.
export async function itemId(txt: string): Promise<string | null> {
  const s = txt.trim();
  if (/^\d{9,15}$/.test(s)) return s;
  const m = s.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})/) ?? s.match(/[?&]item=(\d{9,15})/);
  return m?.[1] ?? null;
}

const num = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

export async function crear(form: FormData) {
  const id = await itemId(String(form.get("item") ?? ""));
  const puja = num(form.get("max_bid"));
  if (!id || !puja) return;
  const fin = String(form.get("ends_at") ?? "");
  const { data } = await db().from("snipes").insert({
    ebay_item_id: id, url: `https://www.ebay.es/itm/${id}`, max_bid: puja,
    title: String(form.get("title") ?? "").trim() || null, notas: String(form.get("notas") ?? "").trim() || null,
    ends_at: fin ? new Date(fin).toISOString() : null,
  }).select("id").single();
  revalidatePath("/snipes");
  // Con Gixen conectado, se programa en el momento (salvo que se desmarque la casilla).
  if (data && gixenActivo() && form.get("enviar") === "1") await enviar(data.id);
}

async function enviar(id: number) {
  const { data: s } = await db().from("snipes").select("ebay_item_id,max_bid").eq("id", id).single();
  if (!s) return;
  let msg = "";
  try {
    await programar(s.ebay_item_id, Number(s.max_bid));
    await db().from("snipes").update({ en_gixen: true }).eq("id", id);
    msg = `✅ Snipe del artículo ${s.ebay_item_id} programado en Gixen (${s.max_bid} €).`;
  } catch (e) { msg = "❌ " + mensajeError(e); }
  revalidatePath("/snipes");
  redirect("/snipes?msg=" + encodeURIComponent(msg));
}

export async function enviarGixen(form: FormData) {
  await enviar(Number(form.get("id")));
}

export async function quitarGixen(form: FormData) {
  const id = Number(form.get("id"));
  const { data: s } = await db().from("snipes").select("ebay_item_id").eq("id", id).single();
  if (!s) return;
  let msg = "";
  try {
    await quitar(s.ebay_item_id);
    await db().from("snipes").update({ en_gixen: false }).eq("id", id);
    msg = `Snipe del artículo ${s.ebay_item_id} quitado de Gixen.`;
  } catch (e) { msg = "❌ " + mensajeError(e); }
  revalidatePath("/snipes");
  redirect("/snipes?msg=" + encodeURIComponent(msg));
}

// Trae los snipes de Gixen: actualiza título y fecha de fin, importa los que no estén y marca qué sigue en Gixen.
export async function sincronizar() {
  let msg = "";
  try {
    const lista = await listar();
    const { data: locales } = await db().from("snipes").select("id,ebay_item_id,title,en_gixen,estado");
    const porItem = new Map((locales ?? []).map((l) => [l.ebay_item_id, l]));
    let nuevos = 0;
    for (const g of lista) {
      const l = porItem.get(g.itemid);
      const datos = { ends_at: g.fin?.toISOString() ?? null, en_gixen: g.estado === "programado" };
      if (l) await db().from("snipes").update({ ...datos, ...(l.title ? {} : { title: g.titulo || null }) }).eq("id", l.id);
      else {
        await db().from("snipes").insert({ ...datos, ebay_item_id: g.itemid, url: `https://www.ebay.es/itm/${g.itemid}`, max_bid: g.maxbid, title: g.titulo || null });
        nuevos++;
      }
    }
    const enGixen = new Set(lista.map((g) => g.itemid));
    for (const l of locales ?? []) if (l.en_gixen && !enGixen.has(l.ebay_item_id)) await db().from("snipes").update({ en_gixen: false }).eq("id", l.id);
    msg = `🔄 Sincronizado: ${lista.length} snipes en Gixen${nuevos ? `, ${nuevos} importados` : ""}.`;
  } catch (e) { msg = "❌ " + mensajeError(e); }
  revalidatePath("/snipes");
  redirect("/snipes?msg=" + encodeURIComponent(msg));
}

export async function actualizar(form: FormData) {
  const id = Number(form.get("id"));
  const cambios: Record<string, unknown> = {};
  const estado = String(form.get("estado") ?? "");
  if (["pendiente", "ganada", "perdida"].includes(estado)) cambios.estado = estado;
  if (form.has("precio_pagado")) cambios.precio_pagado = num(form.get("precio_pagado"));
  if (form.has("en_gixen")) cambios.en_gixen = form.get("en_gixen") === "1";
  if (Object.keys(cambios).length) await db().from("snipes").update(cambios).eq("id", id);

  // Ganada con precio → pasa sola a "Mi negocio" (una sola vez por snipe).
  const { data: s } = await db().from("snipes").select("*").eq("id", id).single();
  if (s?.estado === "ganada" && s.precio_pagado) {
    const titulo = s.title ?? `Artículo eBay ${s.ebay_item_id}`;
    const r = reconocer(titulo, personajes());
    await db().from("inventario").upsert({
      snipe_id: s.id, descripcion: titulo, comprado_en: "eBay (Gixen)", precio_compra: s.precio_pagado,
      fecha_compra: new Date().toISOString().slice(0, 10), notas: s.notas,
      ...(r.ok ? { personaje_id: r.personaje.id, tipo: r.tipo, certificado: r.certificados[0] ?? null } : {}),
    }, { onConflict: "snipe_id" });
  } else if (s && s.estado !== "ganada") {
    await db().from("inventario").delete().eq("snipe_id", s.id).eq("estado", "en_stock");
  }
  revalidatePath("/snipes");
  revalidatePath("/negocio");
}

export async function borrar(form: FormData) {
  await db().from("snipes").delete().eq("id", Number(form.get("id")));
  revalidatePath("/snipes");
}
