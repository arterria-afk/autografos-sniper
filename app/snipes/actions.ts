"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";

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
  await db().from("snipes").insert({
    ebay_item_id: id, url: `https://www.ebay.es/itm/${id}`, max_bid: puja,
    title: String(form.get("title") ?? "").trim() || null, notas: String(form.get("notas") ?? "").trim() || null,
    ends_at: fin ? new Date(fin).toISOString() : null,
  });
  revalidatePath("/snipes");
}

export async function actualizar(form: FormData) {
  const id = Number(form.get("id"));
  const cambios: Record<string, unknown> = {};
  const estado = String(form.get("estado") ?? "");
  if (["pendiente", "ganada", "perdida"].includes(estado)) cambios.estado = estado;
  if (form.has("precio_pagado")) cambios.precio_pagado = num(form.get("precio_pagado"));
  if (form.has("en_gixen")) cambios.en_gixen = form.get("en_gixen") === "1";
  if (Object.keys(cambios).length) await db().from("snipes").update(cambios).eq("id", id);
  revalidatePath("/snipes");
}

export async function borrar(form: FormData) {
  await db().from("snipes").delete().eq("id", Number(form.get("id")));
  revalidatePath("/snipes");
}
