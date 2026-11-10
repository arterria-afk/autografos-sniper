import sharp from "sharp";
import { db } from "./supabase";

const HOSTS_OK = [/\.vinted\.net$/, /\.ebayimg\.com$/, /\.wallapop\.com$/];

// Copia la foto (miniatura WebP ≤400 px) al bucket "fotos" y devuelve la ruta.
export async function copiarFoto(url: string, nombre: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !HOSTS_OK.some((r) => r.test(u.hostname))) return null;
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const webp = await sharp(buf).resize(400, 400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    const path = `${nombre.replace(/[^a-z0-9_-]/gi, "_")}.webp`;
    const { error } = await db().storage.from("fotos").upload(path, webp, { contentType: "image/webp", upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}
