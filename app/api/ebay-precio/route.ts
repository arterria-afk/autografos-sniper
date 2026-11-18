import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { aEUR, ebayActivo, MERCADOS } from "@/lib/ebay";

export const maxDuration = 60;

// Consulta de precios en eBay para CUALQUIER carta (no guarda nada). GET ?q=…&mercados=EBAY_US,EBAY_GB
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  if (!ebayActivo()) return NextResponse.json({ error: "sin claves de eBay" }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const mercados = (sp.get("mercados") ?? "EBAY_US,EBAY_GB,EBAY_DE,EBAY_ES").split(",");
  const { tokenEbay } = await import("@/lib/ebay");
  const out: { mercado: string; id: string; titulo: string; eur: number; tipo: string; pujas: number | null; fin: string | null }[] = [];
  for (const m of mercados) {
    const u = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    u.search = new URLSearchParams({ q, limit: "100" }).toString();
    const r = await fetch(u, { headers: { authorization: `Bearer ${await tokenEbay()}`, "X-EBAY-C-MARKETPLACE-ID": m } });
    if (!r.ok) continue;
    const j = (await r.json()) as { itemSummaries?: { legacyItemId?: string; itemId: string; title: string; price?: { value: string; currency: string }; currentBidPrice?: { value: string; currency: string }; buyingOptions?: string[]; bidCount?: number; itemEndDate?: string }[] };
    for (const s of j.itemSummaries ?? []) {
      const sub = !!s.buyingOptions?.includes("AUCTION") && !s.buyingOptions?.includes("FIXED_PRICE");
      const p = sub ? (s.currentBidPrice ?? s.price) : s.price;
      if (!p) continue;
      out.push({
        mercado: m, id: s.legacyItemId ?? s.itemId.split("|")[1], titulo: s.title,
        eur: Math.round(Number(p.value) * (await aEUR(p.currency)) * 100) / 100,
        tipo: sub ? "subasta" : "fijo", pujas: s.bidCount ?? null, fin: s.itemEndDate ?? null,
      });
    }
  }
  const unicos = [...new Map(out.map((x) => [x.id, x])).values()];
  return NextResponse.json({ q, n: unicos.length, items: unicos, mercados: Object.keys(MERCADOS) });
}
