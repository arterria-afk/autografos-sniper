import { db } from "./supabase";

// Tipos que se parecen lo bastante para usarse como referencia de nivel 2.
const PARECIDOS: Record<string, string[]> = {
  foto: ["poster"], poster: ["foto"], camiseta: [], balon: [], tarjeta: [], vinilo: [], zapatilla: [], otro: [],
};

export type Comp = { title: string; price: number; url: string | null; fecha: string | null; fuente: string };
export type Referencia = { precio: number; fuente: "mis_ventas" | "vinted_sold" | "ventas" | "ebay"; nivel: 1 | 2; muestra: number; comps: Comp[] };

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentil = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

export const FUENTE: Record<Referencia["fuente"], string> = { mis_ventas: "mis ventas", vinted_sold: "ventas Vinted", ventas: "ventas reales", ebay: "eBay en venta" };

// Cascada: mis ventas → ventas reales Vinted (mismo tipo → tipo parecido) → anuncios eBay → "no sé".
export async function resolverReferencia(personajeId: string, tipo: string, excluirId?: string): Promise<Referencia | null> {
  const hace90 = new Date(Date.now() - 90 * 864e5).toISOString();

  // 0) Mis propias ventas (las más fiables), último año.
  const { data: mias } = await db().from("inventario")
    .select("descripcion,precio_venta,fecha_venta")
    .eq("personaje_id", personajeId).eq("tipo", tipo).eq("estado", "vendida").not("certificado", "is", null)
    .gte("fecha_venta", new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10))
    .order("fecha_venta", { ascending: false }).limit(30);
  const mv = (mias ?? []).filter((x) => Number(x.precio_venta) > 0);
  if (mv.length >= 2) {
    return {
      precio: Math.round(mediana(mv.map((x) => Number(x.precio_venta)))), fuente: "mis_ventas", nivel: 1, muestra: mv.length,
      comps: mv.slice(0, 4).map((x) => ({ title: x.descripcion, price: Number(x.precio_venta), url: null, fecha: x.fecha_venta, fuente: "Mi venta" })),
    };
  }
  const niveles: [1 | 2, string[]][] = [[1, [tipo]], [2, PARECIDOS[tipo] ?? []]];

  for (const [nivel, tipos] of niveles) {
    if (!tipos.length) continue;
    const { data } = await db()
      .from("listings")
      .select("external_id,title,price,url,sold_at")
      .eq("personaje_id", personajeId).in("tipo", tipos).eq("con_certificado", true)
      .eq("status", "vendido").eq("descartado", false).gte("sold_at", hace90)
      .order("sold_at", { ascending: false }).limit(50);
    const v = (data ?? []).filter((x) => x.external_id !== excluirId && x.price > 0);
    if (v.length >= 2) {
      return {
        precio: Math.round(mediana(v.map((x) => Number(x.price)))), fuente: "vinted_sold", nivel, muestra: v.length,
        comps: v.slice(0, 4).map((x) => ({ title: x.title, price: Number(x.price), url: x.url, fecha: x.sold_at, fuente: "Vinted vendido" })),
      };
    }
  }

  // eBay: anuncios activos (precio pedido, inflado → percentil 25).
  const { data: eb } = await db()
    .from("listings")
    .select("title,price,url,last_seen_at")
    .eq("platform", "ebay").eq("personaje_id", personajeId).eq("tipo", tipo).eq("con_certificado", true)
    .eq("status", "activo").eq("descartado", false).eq("currency", "EUR").limit(100);
  const e = (eb ?? []).filter((x) => x.price > 0);
  if (e.length >= 3) {
    const precios = e.map((x) => Number(x.price));
    return {
      precio: Math.round(e.length >= 4 ? percentil(precios, 25) : mediana(precios)), fuente: "ebay", nivel: 1, muestra: e.length,
      comps: e.sort((a, b) => a.price - b.price).slice(0, 4).map((x) => ({ title: x.title, price: Number(x.price), url: x.url, fecha: null, fuente: "eBay (en venta)" })),
    };
  }
  return null; // Mejor no dar precio que dar uno malo.
}

// CARTAS: solo se compara con la MISMA carta (misma colección, temporada, paralela, numeración y nota).
export async function referenciaCarta(clave: string, excluirId?: string): Promise<Referencia | null> {
  const hace120 = new Date(Date.now() - 120 * 864e5).toISOString();
  const { data, error } = await db().from("listings")
    .select("external_id,title,price,url,sold_at,platform")
    .eq("carta_clave", clave).eq("status", "vendido").eq("descartado", false).gte("sold_at", hace120)
    .order("sold_at", { ascending: false }).limit(50);
  if (error) return null;
  const v = (data ?? []).filter((x) => x.external_id !== excluirId && x.price > 0);
  if (v.length >= 2) {
    return {
      precio: Math.round(mediana(v.map((x) => Number(x.price)))), fuente: "ventas", nivel: 1, muestra: v.length,
      comps: v.slice(0, 4).map((x) => ({ title: x.title, price: Number(x.price), url: x.url, fecha: x.sold_at, fuente: `${x.platform} vendido` })),
    };
  }
  const { data: eb } = await db().from("listings").select("title,price,url")
    .eq("platform", "ebay").eq("carta_clave", clave).eq("status", "activo").eq("currency", "EUR").limit(100);
  const e = (eb ?? []).filter((x) => x.price > 0);
  if (e.length >= 3) {
    const precios = e.map((x) => Number(x.price));
    return {
      precio: Math.round(e.length >= 4 ? percentil(precios, 25) : mediana(precios)), fuente: "ebay", nivel: 1, muestra: e.length,
      comps: e.sort((a, b) => a.price - b.price).slice(0, 4).map((x) => ({ title: x.title, price: Number(x.price), url: x.url, fecha: null, fuente: "eBay (en venta)" })),
    };
  }
  return null;
}

export type Juicio = { esChollo: boolean; descuento: number | null; aviso: string | null };

export function juzgar(precio: number, ref: Referencia | null): Juicio {
  if (!ref) return { esChollo: false, descuento: null, aviso: null };
  const descuento = Math.round((1 - precio / ref.precio) * 100);
  if (descuento < 25) return { esChollo: false, descuento, aviso: null };
  if (descuento >= 70 && (ref.muestra < 4 || ref.nivel > 1))
    return { esChollo: false, descuento, aviso: "Descuento demasiado grande con poca referencia: revisa bien (posible error o falsificación)." };
  return { esChollo: true, descuento, aviso: null };
}
