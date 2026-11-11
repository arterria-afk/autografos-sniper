import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db, fetchAll } from "@/lib/supabase";
import { reconocer } from "@/lib/recognize";
import { reconocerCarta } from "@/lib/cartas";
import { jugadores, personajes } from "@/lib/personajes";

export const maxDuration = 60;

type F = {
  id: number; title: string; descripcion?: string | null; personaje_id: string; tipo: string; certificados: string[]; con_certificado: boolean;
  kind?: string; carta_clave?: string | null;
};

// Vuelve a pasar el reconocedor que toca (cartas o autógrafos) por todo lo guardado:
// borra lo que ahora se rechaza y corrige el resto.
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const leer = (campos: string) =>
    fetchAll<F>(async (a, b) => {
      const { data, error } = await db().from("listings").select(campos).order("id").range(a, b);
      return { data: data as unknown as F[] | null, error };
    });
  const base = "id,title,personaje_id,tipo,certificados,con_certificado";
  let filas: F[];
  try { filas = await leer(base + ",descripcion,kind,carta_clave"); }
  catch {
    try { filas = await leer(base + ",descripcion"); } // sin migración 004
    catch { filas = await leer(base); } // sin migración 002
  }

  const borrar: number[] = [], motivos: Record<string, number> = {}, ejemplos: string[] = [];
  const anotar = (id: number, motivo: string, titulo: string) => {
    borrar.push(id);
    motivos[motivo] = (motivos[motivo] ?? 0) + 1;
    if (ejemplos.length < 15) ejemplos.push(`${motivo}: ${titulo}`);
  };
  let corregidos = 0;

  for (const l of filas) {
    if (l.kind === "carta") {
      const c = reconocerCarta(l.title, jugadores());
      if (!c.ok) { anotar(l.id, `carta_${c.motivo}`, l.title); continue; }
      if (c.clave !== l.carta_clave || c.jugador.id !== l.personaje_id) {
        await db().from("listings").update({
          personaje_id: c.jugador.id, carta_clave: c.clave, carta_desc: c.descripcion, carta_grado: c.grado,
          carta_numerada: c.numerada, carta_auto: c.auto, certificados: c.grado ? [c.grado] : [],
        }).eq("id", l.id);
        corregidos++;
      }
      continue;
    }
    const r = reconocer(l.title, personajes(), l.descripcion ?? "");
    if (!r.ok) { anotar(l.id, r.motivo, l.title); continue; }
    // Autógrafos = solo memorabilia: las cartas guardadas aquí por versiones antiguas se borran
    // (si son cartas con valor, volverán a entrar como "carta" en la próxima pasada).
    if (r.tipo === "tarjeta") { anotar(l.id, "carta_en_autografos", l.title); continue; }
    if (r.personaje.id !== l.personaje_id || r.tipo !== l.tipo || r.conCertificado !== l.con_certificado || r.certificados.join() !== l.certificados.join()) {
      await db().from("listings").update({ personaje_id: r.personaje.id, tipo: r.tipo, tamano: r.tamano, certificados: r.certificados, con_certificado: r.conCertificado, coa_generico: r.coaGenerico }).eq("id", l.id);
      corregidos++;
    }
  }
  for (let i = 0; i < borrar.length; i += 200) await db().from("listings").delete().in("id", borrar.slice(i, i + 200));
  return NextResponse.json({ revisados: filas.length, borrados: borrar.length, corregidos, motivos, ejemplos });
}
