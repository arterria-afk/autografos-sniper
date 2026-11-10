import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { copiarFoto } from "@/lib/fotos";

export const maxDuration = 60;

// GET → cola de anuncios de Vinted a revisar (¿se ha vendido?).
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const limite = Math.min(Number(new URL(req.url).searchParams.get("n") ?? 60), 200);
  const hace3h = new Date(Date.now() - 3 * 3600e3).toISOString();
  const hace2h = new Date(Date.now() - 2 * 3600e3).toISOString();
  const base = () => db().from("listings").select("external_id,url").eq("platform", "vinted").in("status", ["activo", "reservado"]);

  // 1) Certificados nunca revisados · 2) desaparecidos hace poco de las búsquedas · 3) los revisados hace más tiempo.
  const [a, b, c] = await Promise.all([
    base().eq("con_certificado", true).is("checked_at", null).limit(limite),
    base().lt("last_seen_at", hace2h).or(`checked_at.is.null,checked_at.lt.${hace3h}`).order("last_seen_at", { ascending: false }).limit(limite),
    base().lt("checked_at", hace3h).order("checked_at", { ascending: true }).limit(limite),
  ]);
  const vistos = new Set<string>();
  const cola = [...(a.data ?? []), ...(b.data ?? []), ...(c.data ?? [])].filter((x) => !vistos.has(x.external_id) && vistos.add(x.external_id)).slice(0, limite);
  return NextResponse.json({ cola });
}

type Res = { external_id: string; estado: "activo" | "reservado" | "vendido" | "borrado"; price?: number; photo?: string | null };

// POST → resultados de la revisión. Vendido = venta real (se copia la foto).
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { resultados = [] } = (await req.json()) as { resultados: Res[] };
  const ahora = new Date().toISOString();
  let ventas = 0;
  for (const r of resultados) {
    const cambios: Record<string, unknown> = { checked_at: ahora, status: r.estado };
    if (r.estado === "vendido") {
      const { data: l } = await db().from("listings").select("status,photo_url,photo_path").eq("external_id", r.external_id).single();
      if (l?.status !== "vendido") {
        cambios.sold_at = ahora;
        if (r.price) cambios.price = r.price;
        const foto = r.photo ?? l?.photo_url;
        if (foto && !l?.photo_path) cambios.photo_path = await copiarFoto(foto, r.external_id);
        ventas++;
      }
    }
    await db().from("listings").update(cambios).eq("external_id", r.external_id);
  }
  return NextResponse.json({ procesados: resultados.length, ventas });
}
