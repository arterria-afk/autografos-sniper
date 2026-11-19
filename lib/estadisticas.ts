// Resumen por celebridad (autógrafos) y por jugador (cartas): anuncios analizados, ventas, chollos…
// Se calcula sobre todo lo guardado y se cachea 10 minutos para que la web cargue rápido.
import { unstable_cache } from "next/cache";
import { db, fetchAll } from "./supabase";
import { fotoPublica } from "./fotos-url";

type Fila = {
  id: number; personaje_id: string; kind: string | null; status: string; con_certificado: boolean; price: number;
  photo_url: string | null; photo_path: string | null; seen_at: string; carta_clave: string | null; carta_grado: string | null;
  carta_auto: boolean | null; descartado: boolean; platform: string;
};

export type StatsPersona = {
  id: string; analizados: number; nuevos7d: number; activos: number; vendidos: number; medianaVenta: number | null;
  chollos: number; foto: string | null; plataformas: Record<string, number>;
  // autógrafos
  certificados: number;
  // cartas
  distintas: number; graduadas: number; autos: number;
};

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

async function calcular() {
  const filas = await fetchAll<Fila>(async (a, b) => {
    const { data, error } = await db().from("listings")
      .select("id,personaje_id,kind,status,con_certificado,price,photo_url,photo_path,seen_at,carta_clave,carta_grado,carta_auto,descartado,platform")
      .order("id").range(a, b);
    return { data: data as Fila[] | null, error };
  });
  const chollosPorListing = new Set(
    (await fetchAll<{ listing_id: number }>(async (a, b) => {
      const { data, error } = await db().from("deals").select("listing_id").eq("es_chollo", true).range(a, b);
      return { data, error };
    })).map((d) => d.listing_id),
  );

  const hace7 = Date.now() - 7 * 864e5;
  const nuevo = (id: string): StatsPersona => ({
    id, analizados: 0, nuevos7d: 0, activos: 0, vendidos: 0, medianaVenta: null, chollos: 0, foto: null, plataformas: {},
    certificados: 0, distintas: 0, graduadas: 0, autos: 0,
  });
  const auto: Record<string, StatsPersona> = {}, cartas: Record<string, StatsPersona> = {};
  const ventas: Record<string, number[]> = {}, claves: Record<string, Set<string>> = {};
  const fotoPrioridad: Record<string, number> = {};

  for (const l of filas) {
    if (l.descartado) continue;
    const esCarta = l.kind === "carta";
    const tabla = esCarta ? cartas : auto;
    const k = (esCarta ? "c:" : "a:") + l.personaje_id;
    const s = (tabla[l.personaje_id] ??= nuevo(l.personaje_id));
    s.analizados++;
    s.plataformas[l.platform] = (s.plataformas[l.platform] ?? 0) + 1;
    if (new Date(l.seen_at).getTime() > hace7) s.nuevos7d++;
    if (l.status === "activo" || l.status === "subasta") s.activos++;
    if (chollosPorListing.has(l.id)) s.chollos++;
    if (esCarta) {
      if (l.carta_clave) (claves[l.personaje_id] ??= new Set()).add(l.carta_clave);
      if (l.carta_grado) s.graduadas++;
      if (l.carta_auto) s.autos++;
    } else if (l.con_certificado) s.certificados++;
    if (l.status === "vendido" && l.price > 0 && (esCarta || l.con_certificado)) (ventas[k] ??= []).push(Number(l.price));
    // Foto: preferir vendidos/certificados con foto propia; si no, cualquiera.
    const prio = (l.photo_path ? 3 : 0) + (l.status === "vendido" ? 2 : 0) + (l.con_certificado || esCarta ? 1 : 0);
    if ((l.photo_url || l.photo_path) && prio >= (fotoPrioridad[k] ?? -1)) { fotoPrioridad[k] = prio; s.foto = fotoPublica(l.photo_path, l.photo_url); }
  }
  for (const [id, s] of Object.entries(auto)) { s.vendidos = ventas["a:" + id]?.length ?? 0; s.medianaVenta = mediana(ventas["a:" + id] ?? []); }
  for (const [id, s] of Object.entries(cartas)) {
    s.vendidos = ventas["c:" + id]?.length ?? 0; s.medianaVenta = mediana(ventas["c:" + id] ?? []); s.distintas = claves[id]?.size ?? 0;
  }
  return { auto, cartas, total: filas.length, calculado: new Date().toISOString() };
}

export const estadisticas = unstable_cache(calcular, ["estadisticas-personas-v1"], { revalidate: 600 });

// Detalle de las cartas de un jugador, agrupadas por colección.
export async function cartasDeJugador(id: string) {
  const filas = await fetchAll<{ carta_clave: string | null; carta_desc: string | null; status: string; price: number; url: string; title: string; platform: string; photo_url: string | null; sold_at: string | null }>(
    async (a, b) => {
      const { data, error } = await db().from("listings")
        .select("carta_clave,carta_desc,status,price,url,title,platform,photo_url,sold_at")
        .eq("kind", "carta").eq("personaje_id", id).eq("descartado", false).range(a, b);
      return { data, error };
    },
  );
  type Grupo = { clave: string; desc: string; anuncios: number; activos: { price: number; url: string; title: string; platform: string }[]; ventas: { price: number; url: string; fecha: string | null }[]; foto: string | null };
  const grupos = new Map<string, Grupo>();
  for (const f of filas) {
    if (!f.carta_clave) continue;
    const g = grupos.get(f.carta_clave) ?? { clave: f.carta_clave, desc: f.carta_desc ?? f.carta_clave, anuncios: 0, activos: [], ventas: [], foto: null };
    g.anuncios++;
    if (!g.foto && f.photo_url) g.foto = f.photo_url;
    if (f.status === "vendido") g.ventas.push({ price: Number(f.price), url: f.url, fecha: f.sold_at });
    else if (f.status === "activo") g.activos.push({ price: Number(f.price), url: f.url, title: f.title, platform: f.platform });
    grupos.set(f.carta_clave, g);
  }
  // Por colección (2.º campo de la clave)
  const porColeccion = new Map<string, Grupo[]>();
  for (const g of grupos.values()) {
    const col = g.clave.split("|")[1] ?? "?";
    porColeccion.set(col, [...(porColeccion.get(col) ?? []), g]);
  }
  return [...porColeccion.entries()]
    .map(([col, gs]) => ({ coleccion: col, anuncios: gs.reduce((a, g) => a + g.anuncios, 0), cartas: gs.sort((a, b) => b.ventas.length - a.ventas.length || b.anuncios - a.anuncios) }))
    .sort((a, b) => b.anuncios - a.anuncios);
}
