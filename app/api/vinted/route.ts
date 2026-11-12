import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { ingerir, type Item } from "@/lib/ingesta";

export const maxDuration = 60;

// Recibe anuncios (Vinted, Wallapop…) desde GitHub Actions. mode=live → alerta los nuevos; mode=sweep → solo guarda.
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { items = [], mode = "live", platform = "vinted" } = (await req.json()) as { items: Item[]; mode?: string; platform?: string };
  const r = await ingerir(items, platform, mode);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json(r);
}
