import { db } from "./supabase";

// Tipos que se parecen lo bastante para usarse como referencia de nivel 2.
const PARECIDOS: Record<string, string[]> = {
  foto: ["poster"], poster: ["foto"], camiseta: [], balon: [], tarjeta: [], vinilo: [], zapatilla: [], otro: [],
};

export type Comp = { title: string; price: number; url: string | null; fecha: string | null; fuente: string };
export type Referencia = { precio: number; fuente: "vinted_sold" | "ebay"; nivel: 1 | 2; muestra: number; comps: Comp[] };

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentil = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

// Cascada: ventas reales Vinted (mismo tipo → tipo parecido) → anuncios eBay → "no sé".
export async function resolverReferencia(personajeId: string, tipo: string, excluirId?: string): Promise<Referencia | null> {
  const hace90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const niveles: [1 | 2, string[]][] = [[1, [tipo]], [2, PARECIDOS[tipo] ?? []]];

  for (const [nivel, tipos] of niveles) {
    if (!tipos.length) continue;
    const { data } = await db()
      .from("listings")
      .select("external_id,title,price,url,sold_at")
      .eq("personaje_id", personajeId).in("tipo", tipos).eq("con_certificado", true)
      .eq("status", "vendido").gte("sold_at", hace90)
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
    .eq("status", "activo").eq("currency", "EUR").limit(100);
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

export type Juicio = { esChollo: boolean; descuento: number | null; aviso: string | null };

export function juzgar(precio: number, ref: Referencia | null): Juicio {
  if (!ref) return { esChollo: false, descuento: null, aviso: null };
  const descuento = Math.round((1 - precio / ref.precio) * 100);
  if (descuento < 25) return { esChollo: false, descuento, aviso: null };
  if (descuento >= 70 && (ref.muestra < 4 || ref.nivel > 1))
    return { esChollo: false, descuento, aviso: "Descuento demasiado grande con poca referencia: revisa bien (posible error o falsificación)." };
  return { esChollo: true, descuento, aviso: null };
}
