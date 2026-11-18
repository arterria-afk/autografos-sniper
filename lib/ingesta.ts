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
  fin?: string | null;          // fecha de fin (eBay)
};

const CARTAS_MIN = () => Number(process.env.CARTAS_MIN ?? 25); // precio mínimo para cartas (€)

// Columnas que añaden las migraciones 002 y 004: si aún no existen, se guarda sin ellas.
const OPCIONALES = ["ends_at", "seller", "descripcion", "kind", "carta_clave", "carta_desc", "carta_grado", "carta_numerada", "carta_auto"];

export async function ingerir(items: Item[], platform: string, mode = "live") {
  const rechazos: Record<string, number> = {};
  const filas: Record<string, unknown>[] = [];
  for (const it of items) {
    const base = {
      external_id: `${platform}:${it.id}`, platform, market: it.market ?? "ES",
      title: it.title.slice(0, 300), price: it.price, currency: it.currency ?? "EUR",
      url: it.url, photo_url: it.photo ?? null, status: it.subasta ? "subasta" : "activo", ...(it.fin ? { ends_at: it.fin } : {}), seller: it.seller ?? null, descripcion: it.description?.slice(0, 2000) || null,
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
  // Si falta alguna columna opcional (migración pendiente), se quita SOLO esa y se reintenta.
  // Sin las columnas de cartas (004), las cartas no se guardan: quedarían mezcladas con los autógrafos.
  let filasG = filas;
  let { data: nuevos, error } = filasG.length ? await guardar(filasG) : { data: [], error: null };
  for (let i = 0; i < OPCIONALES.length && error; i++) {
    const falta = OPCIONALES.find((k) => error!.message.includes(k));
    if (!falta) break;
    const quitar = ["kind", "carta_clave", "carta_desc", "carta_grado", "carta_numerada", "carta_auto"].includes(falta)
      ? ["kind", "carta_clave", "carta_desc", "carta_grado", "carta_numerada", "carta_auto"] : [falta];
    if (quitar.length > 1) filasG = filasG.filter((f) => f.kind !== "carta");
    filasG = filasG.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !quitar.includes(k))));
    ({ data: nuevos, error } = filasG.length ? await guardar(filasG) : { data: [], error: null });
  }
  if (error) return { ok: false as const, error: error.message };
  const nuevosIds = new Set((nuevos ?? []).map((n) => n.external_id));
  const vistos = filas.map((f) => f.external_id as string).filter((id) => !nuevosIds.has(id));
  if (vistos.length) await db().from("listings").update({ last_seen_at: new Date().toISOString() }).in("external_id", vistos);
  // Anuncios ya guardados que ahora traen fecha de fin (subastas de eBay): apuntarla para revisar el resultado al terminar.
  const conFin = filas.filter((f) => f.ends_at && vistos.includes(f.external_id as string)).slice(0, 100);
  await Promise.all(conFin.map((f) => db().from("listings").update({ ends_at: f.ends_at }).eq("external_id", f.external_id as string).is("ends_at", null)));

  let alertas = 0;
  // Vinted: la búsqueda no trae la descripción → las alertas esperan a que el script la lea (ver /api/descripcion).
  const pendientes = platform === "vinted" && mode === "live"
    ? (nuevos ?? []).map((n) => ({ external_id: n.external_id as string, url: n.url as string }))
    : [];
  if (mode === "live" && !pendientes.length) {
    // Autógrafos: solo certificados. Cartas: todas (ya filtradas por valor y precio mínimo).
    // Las subastas no se comparan (su precio actual no es el final).
    const candidatos = (nuevos ?? []).filter((n) => n.status !== "subasta" && (n.kind === "carta" || n.con_certificado));
    await Promise.all(candidatos.map((n) => alertar(n)));
    alertas = candidatos.length;
  }
  const cartas = filas.filter((f) => f.kind === "carta").length;
  return { ok: true as const, pendientes, recibidos: items.length, reconocidos: filas.length, cartas, nuevos: nuevosIds.size, alertas, rechazos };
}
