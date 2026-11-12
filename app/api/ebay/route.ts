import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { buscarEbay, ebayActivo } from "@/lib/ebay";
import { ingerir } from "@/lib/ingesta";

export const maxDuration = 60;

// GitHub Actions llama aquí con cada búsqueda; las claves de eBay solo viven en Vercel.
// POST { q, mercado, min }
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  if (!ebayActivo()) return NextResponse.json({ error: "faltan EBAY_CLIENT_ID / EBAY_CLIENT_SECRET en Vercel" }, { status: 503 });
  const { q, mercado = "EBAY_ES", min = 0 } = (await req.json()) as { q: string; mercado?: string; min?: number };
  try {
    const items = await buscarEbay(q, mercado, min);
    const r = await ingerir(items, "ebay", "live");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({ ...r, subastas: items.filter((i) => i.subasta).length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
