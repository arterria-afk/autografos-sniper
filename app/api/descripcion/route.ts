import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { alertar } from "@/lib/alertas";
import type { Interes } from "@/lib/ingesta";
import { guardarReevaluacion, reevaluar } from "@/lib/descripciones";

export const maxDuration = 60;

// Recibe las descripciones de anuncios nuevos (Vinted) y decide: descartar, corregir certificado y, si procede, alertar.
// POST { items: [{ external_id, descripcion }] }
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { items = [] } = (await req.json()) as { items: { external_id: string; descripcion: string | null; interes?: Interes; sinAlerta?: boolean }[] };
  const res = { recibidos: items.length, descartados: 0, certificados: 0, candidatos: 0, motivos: {} as Record<string, number> };
  const candidatos: Record<string, unknown>[] = [];
  for (const it of items) {
    const { data: l } = await db().from("listings").select("*").eq("external_id", it.external_id).single();
    if (!l) continue;
    const ev = reevaluar(l, it.descripcion ?? "");
    await guardarReevaluacion(l.id, ev);
    if (ev.descartar) { res.descartados++; const m = (ev.motivo ?? "").split(" ")[0]; res.motivos[m] = (res.motivos[m] ?? 0) + 1; continue; }
    if (ev.certificado) res.certificados++;
    const fila = { ...l, ...ev.cambios, interes: it.interes };
    if (!it.sinAlerta && fila.status !== "subasta" && (fila.kind === "carta" || fila.con_certificado)) candidatos.push(fila);
  }
  res.candidatos = candidatos.length;
  await Promise.all(candidatos.map((c) => alertar(c as Parameters<typeof alertar>[0])));
  return NextResponse.json(res);
}
