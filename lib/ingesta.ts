// Entrada común de anuncios (Vinted, Wallapop, eBay): reconoce, guarda y lanza alertas.
import { db } from "./supabase";
import { reconocer } from "./recognize";
import { reconocerCarta } from "./cartas";
import { jugadores, personajes } from "./personajes";
import { alertar } from "./alertas";

export type Item = {
  id: string | number; title: string; description?: string; price: number; currency?: string; url: string;
  photo?: string | null; market?: string; seller?: string | null;
  subasta?: boolean;            // subasta de eBay: el precio actual no es el final → no se compara ni alerta
  tituloReconocer?: string;     // título "destraducido" (eBay ES/DE traduce los títulos)
};

const CARTAS_MIN = () => Number(process.env.CARTAS_MIN ?? 25); // precio mínimo para cartas (€)

// Columnas que añaden las migraciones 002 y 004: si aún no existen, se guarda sin ellas.
const OPCIONALES = ["seller", "descripcion", "kind", "carta_clave", "carta_desc", "carta_grado", "carta_numerada", "carta_auto"];

export async function ingerir(items: Item[], platform: string, mode = "live") {
  const rechazos: Record<string, number> = {};
  const filas: Record<string, unknown>[] = [];
  for (const it of items) {
    const base = {
      external_id: `${platform}:${it.id}`, platform, market: it.market ?? "ES",
      title: it.title.slice(0, 300), price: it.price, currency: it.currency ?? "EUR",
      url: it.url, photo_url: it.photo ?? null, status: it.subasta ? "subasta" : "activo", seller: it.seller ?? null, descripcion: it.description?.slice(0, 2000) || null,
    };

    const c = reconocerCarta(it.tituloReconocer ?? it.title, jugadores());
    if (c.ok) {
      if (it.price < CARTAS_MIN()) { rechazos.carta_barata = (rechazos.carta_barata ?? 0) + 1; continue; }
      filas.push({
        ...base, kind: "carta", personaje_id: c.jugador.id, tipo: "tarjeta",
        certificados: c.grado ? [c.grado] : [], con_certificado: false, coa_generico: false,
        carta_clave: c.clave, carta_desc: c.descripcion, carta_grado: c.grado, carta_numerada: c.numerada, carta_auto: c.auto,
      });
      continue;
    }

    const r = reconocer(it.tituloReconocer ?? it.title, personajes(), it.description ?? "");
    if (!r.ok) { const m = c.motivo === "sin_jugador" ? r.motivo : `carta_${c.motivo}`; rechazos[m] = (rechazos[m] ?? 0) + 1; continue; }
    // Autógrafos = solo memorabilia. Una carta (firmada o no) nunca entra aquí: o es "carta" con valor, o se descarta.
    if (r.tipo === "tarjeta" || c.motivo !== "sin_jugador" && c.motivo !== "no_es_carta") {
      const m = `carta_${c.motivo}`; rechazos[m] = (rechazos[m] ?? 0) + 1; continue;
    }
    filas.push({
      ...base, kind: "autografo", personaje_id: r.personaje.id, tipo: r.tipo, tamano: r.tamano,
      certificados: r.certificados, con_certificado: r.conCertificado, coa_generico: r.coaGenerico,
    });
  }

  // Inserta solo los nuevos; los que ya existían se marcan como vistos ahora.
  const guardar = (rows: Record<string, unknown>[]) =>
    db().from("listings").upsert(rows, { onConflict: "external_id", ignoreDuplicates: true }).select("*");
  let { data: nuevos, error } = filas.length ? await guardar(filas) : { data: [], error: null };
  if (error && OPCIONALES.some((k) => error!.message.includes(k))) {
    // Migraciones pendientes: las CARTAS no se guardan (si no, quedarían mezcladas con los autógrafos).
    const soloAutografos = filas.filter((f) => f.kind !== "carta");
    ({ data: nuevos, error } = soloAutografos.length
      ? await guardar(soloAutografos.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !OPCIONALES.includes(k)))))
      : { data: [], error: null });
  }
  if (error) return { ok: false as const, error: error.message };
  const nuevosIds = new Set((nuevos ?? []).map((n) => n.external_id));
  const vistos = filas.map((f) => f.external_id as string).filter((id) => !nuevosIds.has(id));
  if (vistos.length) await db().from("listings").update({ last_seen_at: new Date().toISOString() }).in("external_id", vistos);

  let alertas = 0;
  if (mode === "live") {
    // Autógrafos: solo certificados. Cartas: todas (ya filtradas por valor y precio mínimo).
    // Las subastas no se comparan (su precio actual no es el final).
    const candidatos = (nuevos ?? []).filter((n) => n.status !== "subasta" && (n.kind === "carta" || n.con_certificado));
    await Promise.all(candidatos.map((n) => alertar(n)));
    alertas = candidatos.length;
  }
  const cartas = filas.filter((f) => f.kind === "carta").length;
  return { ok: true as const, recibidos: items.length, reconocidos: filas.length, cartas, nuevos: nuevosIds.size, alertas, rechazos };
}
