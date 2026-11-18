// Re-evaluar un anuncio con su DESCRIPCIÓN (certificado, quién firma, copias…).
import { db } from "./supabase";
import { reconocer } from "./recognize";
import { personajes } from "./personajes";

// Señales de que una CARTA no es original.
const CARTA_FALSA = /\b(reprint|re-print|proxy|custom|fan[ -]?made|r[eé]plica|replica|copia|no original|not original|facsimile)\b/i;

export type Reevaluacion = { descartar: boolean; motivo?: string; cambios: Record<string, unknown>; certificado: boolean };

export function reevaluar(l: { kind?: string | null; title: string }, desc: string): Reevaluacion {
  const cambios: Record<string, unknown> = { descripcion: desc.slice(0, 2000) || null };
  if (l.kind === "carta") {
    const m = desc.match(CARTA_FALSA);
    return m ? { descartar: true, motivo: `carta: ${m[0]}`, cambios, certificado: false } : { descartar: false, cambios, certificado: false };
  }
  const r = reconocer(l.title, personajes(), desc);
  if (!r.ok) return { descartar: true, motivo: `${r.motivo}${r.detalle ? ` (${r.detalle})` : ""}`, cambios, certificado: false };
  if (r.tipo === "tarjeta") return { descartar: true, motivo: "es carta", cambios, certificado: false };
  Object.assign(cambios, { personaje_id: r.personaje.id, tipo: r.tipo, tamano: r.tamano, certificados: r.certificados, con_certificado: r.conCertificado, coa_generico: r.coaGenerico });
  return { descartar: false, cambios, certificado: r.conCertificado };
}

export async function guardarReevaluacion(id: number, ev: Reevaluacion) {
  await db().from("listings").update({ ...ev.cambios, ...(ev.descartar ? { descartado: true } : {}) }).eq("id", id);
}
