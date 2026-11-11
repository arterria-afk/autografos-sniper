import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db, fetchAll } from "@/lib/supabase";
import { reconocer } from "@/lib/recognize";
import { personajes } from "@/lib/personajes";

export const maxDuration = 60;

// Vuelve a pasar el reconocedor por todo lo guardado: borra lo que ahora se rechaza y corrige el resto.
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  type F = { id: number; title: string; descripcion?: string | null; personaje_id: string; tipo: string; certificados: string[]; con_certificado: boolean };
  const leer = (campos: string) =>
    fetchAll<F>(async (a, b) => {
      const { data, error } = await db().from("listings").select(campos).order("id").range(a, b);
      return { data: data as unknown as F[] | null, error };
    });
  let filas: F[];
  try { filas = await leer("id,title,personaje_id,tipo,certificados,con_certificado,descripcion"); }
  catch { filas = await leer("id,title,personaje_id,tipo,certificados,con_certificado"); } // sin migración 002
  const borrar: number[] = [], motivos: Record<string, number> = {}, ejemplos: string[] = [];
  let corregidos = 0;
  for (const l of filas) {
    const r = reconocer(l.title, personajes(), l.descripcion ?? "");
    if (!r.ok) {
      borrar.push(l.id);
      motivos[r.motivo] = (motivos[r.motivo] ?? 0) + 1;
      if (ejemplos.length < 15) ejemplos.push(`${r.motivo}: ${l.title}`);
      continue;
    }
    if (r.personaje.id !== l.personaje_id || r.tipo !== l.tipo || r.conCertificado !== l.con_certificado || r.certificados.join() !== l.certificados.join()) {
      await db().from("listings").update({ personaje_id: r.personaje.id, tipo: r.tipo, tamano: r.tamano, certificados: r.certificados, con_certificado: r.conCertificado, coa_generico: r.coaGenerico }).eq("id", l.id);
      corregidos++;
    }
  }
  for (let i = 0; i < borrar.length; i += 200) await db().from("listings").delete().in("id", borrar.slice(i, i + 200));
  return NextResponse.json({ revisados: filas.length, borrados: borrar.length, corregidos, motivos, ejemplos });
}
