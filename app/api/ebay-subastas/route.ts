import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { ebayActivo, fichaEbay, subastasQueTerminan } from "@/lib/ebay";

export const maxDuration = 60;

// GET ?q=…&mercado=…        → subastas que terminan antes
// GET ?id=<legacy>&mercado=… → ficha del artículo (para ver precio final tras cerrar)
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  if (!ebayActivo()) return NextResponse.json({ error: "sin claves de eBay" }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const mercado = sp.get("mercado") ?? "EBAY_ES";
  try {
    if (sp.get("id")) {
      const f = await fichaEbay(sp.get("id")!, mercado);
      const j = f.json as Record<string, unknown>;
      const pick = (k: string) => j[k];
      return NextResponse.json({
        status: f.status, error: f.texto,
        titulo: pick("title"), fin: pick("itemEndDate"), precio: pick("price"), puja_actual: pick("currentBidPrice"),
        pujas: pick("bidCount"), opciones: pick("buyingOptions"), disponibilidad: pick("estimatedAvailabilities"),
        claves: Object.keys(j),
      });
    }
    return NextResponse.json({ subastas: await subastasQueTerminan(sp.get("q") ?? "topps psa", mercado, 20) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
