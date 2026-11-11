"use server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { db } from "@/lib/supabase";

const num = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };
const txt = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

// La foto llega ya reducida desde el móvil (data URL JPEG); aquí se pasa a WebP y se guarda.
async function guardarFoto(dataUrl: string | null, id: number) {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const buf = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
  if (buf.length > 3_000_000) return null;
  const webp = await sharp(buf).rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  const path = `inventario/${id}-${Date.now()}.webp`;
  const { error } = await db().storage.from("fotos").upload(path, webp, { contentType: "image/webp", upsert: true });
  return error ? null : path;
}

export async function comprar(form: FormData) {
  const descripcion = txt(form.get("descripcion"));
  if (!descripcion) return;
  const { data } = await db().from("inventario").insert({
    descripcion, personaje_id: txt(form.get("personaje_id")), tipo: txt(form.get("tipo")),
    certificado: txt(form.get("certificado")), cert_numero: txt(form.get("cert_numero")),
    comprado_en: txt(form.get("comprado_en")), fecha_compra: txt(form.get("fecha_compra")) ?? undefined,
    precio_compra: num(form.get("precio_compra")), gastos_compra: num(form.get("gastos_compra")), notas: txt(form.get("notas")),
  }).select("id").single();
  if (data) {
    const foto = await guardarFoto(txt(form.get("foto")), data.id);
    if (foto) await db().from("inventario").update({ foto_path: foto }).eq("id", data.id);
  }
  revalidatePath("/negocio");
}

export async function vender(form: FormData) {
  await db().from("inventario").update({
    estado: "vendida", precio_venta: num(form.get("precio_venta")), gastos_venta: num(form.get("gastos_venta")),
    vendido_en: txt(form.get("vendido_en")), fecha_venta: txt(form.get("fecha_venta")) ?? new Date().toISOString().slice(0, 10),
  }).eq("id", Number(form.get("id")));
  revalidatePath("/negocio");
}

export async function deshacerVenta(form: FormData) {
  await db().from("inventario").update({ estado: "en_stock", precio_venta: null, gastos_venta: 0, vendido_en: null, fecha_venta: null }).eq("id", Number(form.get("id")));
  revalidatePath("/negocio");
}

export async function borrarPieza(form: FormData) {
  await db().from("inventario").delete().eq("id", Number(form.get("id")));
  revalidatePath("/negocio");
}
