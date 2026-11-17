import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { aEUR, ebayActivo, fichaEbay } from "@/lib/ebay";

export const maxDuration = 60;

type Fila = { id: number; external_id: string; status: string; ends_at?: string | null };
type Ficha = {
  itemEndDate?: string; bidCount?: number; price?: { value: string; currency: string }; currentBidPrice?: { value: string; currency: string };
  estimatedAvailabilities?: { estimatedSoldQuantity?: number; estimatedAvailabilityStatus?: string }[];
};

// Revisa anuncios de eBay: subastas recién terminadas (venta real si acabaron con pujas) y algunos de precio fijo.
// POST ?n=40  → usa como mucho n llamadas a eBay.
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  if (!ebayActivo()) return NextResponse.json({ error: "sin claves de eBay" }, { status: 503 });
  const n = Math.min(Number(new URL(req.url).searchParams.get("n") ?? 40), 60);
  const ahora = new Date();
  const hace2min = new Date(ahora.getTime() - 2 * 60e3).toISOString();

  const base = () => db().from("listings").select("id,external_id,status,ends_at").eq("platform", "ebay");
  // 1) subastas terminadas sin revisar · 2) subastas sin fecha de fin (antiguas) · 3) precio fijo, los revisados hace más tiempo
  const [a, b, c] = await Promise.all([
    base().eq("status", "subasta").lt("ends_at", hace2min).is("checked_at", null).order("ends_at", { ascending: false }).limit(n),
    base().eq("status", "subasta").is("ends_at", null).is("checked_at", null).limit(Math.ceil(n / 4)),
    base().eq("status", "activo").order("checked_at", { ascending: true, nullsFirst: true }).limit(Math.ceil(n / 5)),
  ]);
  if (a.error) return NextResponse.json({ error: a.error.message }, { status: 500 }); // p. ej. falta la migración 005
  const vistos = new Set<number>();
  const cola = [...(a.data ?? []), ...(b.data ?? []), ...(c.data ?? [])].filter((x) => !vistos.has(x.id) && vistos.add(x.id)).slice(0, n) as Fila[];

  const res = { revisados: 0, ventas: 0, sin_venta: 0, siguen: 0, errores: 0 };
  for (const l of cola) {
    const id = l.external_id.replace(/^ebay:/, "");
    const f = await fichaEbay(id, "EBAY_US").catch(() => null);
    res.revisados++;
    if (!f) { res.errores++; continue; }
    const cambios: Record<string, unknown> = { checked_at: ahora.toISOString() };
    if (f.status === 404 || f.status === 410) { cambios.status = "borrado"; res.sin_venta++; }
    else if (f.status !== 200) { res.errores++; continue; }
    else {
      const j = f.json as Ficha;
      const fin = j.itemEndDate ? new Date(j.itemEndDate) : null;
      if (fin) cambios.ends_at = fin.toISOString();
      const vendidos = Math.max(0, ...(j.estimatedAvailabilities ?? []).map((x) => Number(x.estimatedSoldQuantity ?? 0)));
      const terminado = !!fin && fin.getTime() < ahora.getTime();
      const p = l.status === "subasta" ? (j.currentBidPrice ?? j.price) : (j.price ?? j.currentBidPrice);
      if (vendidos > 0 && p && (terminado || l.status === "activo")) {
        // VENTA REAL: subasta con pujas al terminar, o precio fijo con unidades vendidas.
        cambios.status = "vendido";
        cambios.sold_at = (terminado ? fin! : ahora).toISOString();
        cambios.price = Math.round(Number(p.value) * (await aEUR(p.currency)) * 100) / 100;
        res.ventas++;
      } else if (terminado) {
        cambios.status = "borrado"; // terminó sin venta
        res.sin_venta++;
      } else {
        if (l.status === "subasta") delete cambios.checked_at; // aún no terminó: se revisará al terminar
        res.siguen++;
      }
    }
    await db().from("listings").update(cambios).eq("id", l.id);
  }
  return NextResponse.json(res);
}
