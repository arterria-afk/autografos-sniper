import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db } from "@/lib/supabase";

// Búsqueda interna en lo guardado. GET ?personaje=…&tipo=…&cert=…&kind=…&texto=…&auto=1&max=200&min=…&estados=activo,subasta
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  let q = db().from("listings")
    .select("title,price,currency,url,platform,market,status,certificados,tipo,kind,seen_at,last_seen_at,carta_desc,ends_at")
    .in("status", (sp.get("estados") ?? "activo,subasta").split(",")).eq("descartado", false)
    .order("price", { ascending: true }).limit(Number(sp.get("n") ?? 40));
  if (sp.get("personaje")) q = q.eq("personaje_id", sp.get("personaje")!);
  if (sp.get("tipo")) q = q.eq("tipo", sp.get("tipo")!);
  if (sp.get("kind")) q = q.eq("kind", sp.get("kind")!);
  if (sp.get("cert")) q = q.contains("certificados", [sp.get("cert")!]);
  if (sp.get("texto")) q = q.ilike("title", `%${sp.get("texto")}%`);
  if (sp.get("auto")) q = q.eq("carta_auto", true);
  if (sp.get("max")) q = q.lte("price", Number(sp.get("max")));
  if (sp.get("min")) q = q.gte("price", Number(sp.get("min")));
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ n: data?.length ?? 0, resultados: data });
}
