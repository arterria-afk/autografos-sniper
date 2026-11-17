import { db } from "./supabase";

// Tipos que se parecen lo bastante para usarse como referencia de nivel 2.
const PARECIDOS: Record<string, string[]> = {
  foto: ["poster"], poster: ["foto"], camiseta: [], balon: [], tarjeta: [], vinilo: [], zapatilla: [], otro: [],
};

export type Comp = { title: string; price: number; url: string | null; fecha: string | null; fuente: string };
export type Referencia = { precio: number; fuente: "mis_ventas" | "vinted_sold" | "ventas" | "ebay" | "en_venta"; nivel: 1 | 2; muestra: number; comps: Comp[] };

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentil = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

export const FUENTE: Record<Referencia["fuente"], string> = { mis_ventas: "mis ventas", vinted_sold: "ventas Vinted", ventas: "ventas reales", ebay: "eBay en venta", en_venta: "otros vendedores" };

// Cascada: mis ventas → ventas reales Vinted (mismo tipo → tipo parecido) → anuncios eBay → "no sé".
export async function resolverReferencia(personajeId: string, tipo: string, excluirId?: string, seller?: string | null): Promise<Referencia | null> {
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

  // Lo que piden otros vendedores (Vinted, Wallapop, eBay) por piezas certificadas del mismo personaje y tipo.
  const ev = await enVenta({ personaje_id: personajeId, tipo }, excluirId, seller, 5);
  if (ev) return ev;
  return null; // Mejor no dar precio que dar uno malo.
}

// CARTAS: solo se compara con la MISMA carta (misma colección, temporada, paralela, numeración y nota).
export async function referenciaCarta(clave: string, excluirId?: string, seller?: string | null): Promise<Referencia | null> {
  // Solo se compara si la carta está bien identificada: colección concreta y temporada conocidas.
  // ("Lamine Yamal PSA 9" sin colección ni año mezclaría cartas distintas → falsos chollos.)
  const [, coleccion, temporada] = clave.split("|");
  if (!coleccion || ["?", "topps", "panini"].includes(coleccion) || temporada === "?") return null;
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
  return enVenta({ carta_clave: clave }, excluirId, seller, 3);
}

export async function enVenta(
  campo: { carta_clave: string } | { personaje_id: string; tipo: string },
  excluirId?: string, seller?: string | null, minimo = 3,
): Promise<Referencia | null> {
  const hace30 = new Date(Date.now() - 30 * 864e5).toISOString();
  let q = db().from("listings").select("external_id,title,price,url,seller,platform")
    .eq("status", "activo").eq("descartado", false).eq("currency", "EUR").gte("last_seen_at", hace30).limit(200);
  q = "carta_clave" in campo ? q.eq("carta_clave", campo.carta_clave) : q.eq("personaje_id", campo.personaje_id).eq("tipo", campo.tipo).eq("con_certificado", true).neq("kind", "carta");
  const { data, error } = await q;
  if (error) return null;
  // Un precio por vendedor (el más bajo) y sin contar el propio anuncio ni al mismo vendedor.
  const porVendedor = new Map<string, { title: string; price: number; url: string; platform: string }>();
  for (const x of data ?? []) {
    if (x.external_id === excluirId || !(Number(x.price) > 0)) continue;
    if (seller && x.seller === seller) continue;
    const k = x.seller ? `${x.platform}:${x.seller}` : x.external_id;
    const prev = porVendedor.get(k);
    if (!prev || Number(x.price) < prev.price) porVendedor.set(k, { title: x.title, price: Number(x.price), url: x.url, platform: x.platform });
  }
  const v = [...porVendedor.values()].sort((a, b) => a.price - b.price);
  if (v.length < minimo) return null;
  const precios = v.map((x) => x.price);
  return {
    precio: Math.round(v.length >= 4 ? percentil(precios, 25) : precios[0]), fuente: "en_venta", nivel: 1, muestra: v.length,
    comps: v.slice(0, 4).map((x) => ({ title: x.title, price: x.price, url: x.url, fecha: null, fuente: `${x.platform} en venta` })),
  };
}

export type Juicio = { esChollo: boolean; descuento: number | null; aviso: string | null };

// ¿Basada en ventas reales? (Si no, son precios pedidos por otros vendedores: solo informativo.)
export const esVentaReal = (ref: Referencia | null) => !!ref && ref.fuente !== "en_venta" && ref.fuente !== "ebay";
// CHOLLO_SOLO_VENTAS=no en Vercel vuelve a permitir chollos con precios pedidos (más avisos, menos fiables).
const soloVentas = () => process.env.CHOLLO_SOLO_VENTAS !== "no";

export function juzgar(precio: number, ref: Referencia | null): Juicio {
  if (!ref) return { esChollo: false, descuento: null, aviso: null };
  if (soloVentas() && !esVentaReal(ref)) {
    const d = Math.round((1 - precio / ref.precio) * 100);
    return { esChollo: false, descuento: d, aviso: null }; // informativo: no hay ventas reales con las que comparar
  }
  const descuento = Math.round((1 - precio / ref.precio) * 100);
  // Con ventas reales basta un 25 %; con precios pedidos por otros vendedores (referencia más débil), un 30 %.
  if (descuento < (ref.fuente === "en_venta" ? 30 : 25)) return { esChollo: false, descuento, aviso: null };
  if (descuento >= 70 && (ref.muestra < 4 || ref.nivel > 1))
    return { esChollo: false, descuento, aviso: "Descuento demasiado grande con poca referencia: revisa bien (posible error o falsificación)." };
  return { esChollo: true, descuento, aviso: null };
}
