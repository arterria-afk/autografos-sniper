import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { reconocer } from "@/lib/recognize";
import { personajes } from "@/lib/personajes";
import { alertar } from "@/lib/alertas";

export const maxDuration = 60;



type Item = { id: string | number; title: string; description?: string; price: number; currency?: string; url: string; photo?: string | null; market?: string; seller?: string | null };

// Recibe anuncios desde GitHub Actions. mode=live → alerta los nuevos; mode=sweep → solo guarda.
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { items = [], mode = "live", platform = "vinted" } = (await req.json()) as { items: Item[]; mode?: string; platform?: string };

  const rechazos: Record<string, number> = {};
  const filas = [];
  for (const it of items) {
    const r = reconocer(it.title, personajes(), it.description ?? "");
    if (!r.ok) { rechazos[r.motivo] = (rechazos[r.motivo] ?? 0) + 1; continue; }
    filas.push({
      external_id: `${platform}:${it.id}`, platform, market: it.market ?? "ES",
      title: it.title.slice(0, 300), price: it.price, currency: it.currency ?? "EUR",
      url: it.url, photo_url: it.photo ?? null, seller: it.seller ?? null, descripcion: it.description?.slice(0, 2000) || null,
      personaje_id: r.personaje.id, tipo: r.tipo, tamano: r.tamano,
      certificados: r.certificados, con_certificado: r.conCertificado, coa_generico: r.coaGenerico,
    });
  }

  // Inserta solo los nuevos; los que ya existían se marcan como vistos ahora.
  const guardar = (rows: Record<string, unknown>[]) =>
    db().from("listings").upsert(rows, { onConflict: "external_id", ignoreDuplicates: true }).select("*");
  let { data: nuevos, error } = filas.length ? await guardar(filas) : { data: [], error: null };
  // Si aún no se ha ejecutado la migración 002 (sin columnas "seller"/"descripcion"), guardar sin ellas.
  if (error && /seller|descripcion/.test(error.message))
    ({ data: nuevos, error } = await guardar(filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "seller" && k !== "descripcion")))));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const nuevosIds = new Set((nuevos ?? []).map((n) => n.external_id));
  const vistos = filas.map((f) => f.external_id).filter((id) => !nuevosIds.has(id));
  if (vistos.length) await db().from("listings").update({ last_seen_at: new Date().toISOString() }).in("external_id", vistos);

  let alertas = 0;
  if (mode === "live") {
    // Solo piezas certificadas; en paralelo (la revisión de la IA tarda unos segundos por anuncio).
    const certificados = (nuevos ?? []).filter((n) => n.con_certificado);
    await Promise.all(certificados.map((n) => alertar(n)));
    alertas = certificados.length;
  }
  return NextResponse.json({ recibidos: items.length, reconocidos: filas.length, nuevos: nuevosIds.size, alertas, rechazos });
}
