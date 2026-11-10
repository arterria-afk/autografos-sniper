import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db, fetchAll } from "@/lib/supabase";

// Resumen de los votos de Telegram: % de aciertos del reconocedor y de la referencia.
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const deals = await fetchAll<{ id: number; external_id: string; fb_obj: string | null; fb_ref: string | null; es_chollo: boolean }>(
    (a, b) => db().from("deals").select("id,external_id,fb_obj,fb_ref,es_chollo").not("feedback_at", "is", null).range(a, b),
  );
  const cuenta = (campo: "fb_obj" | "fb_ref") =>
    deals.reduce<Record<string, number>>((acc, d) => { const v = d[campo]; if (v) acc[v] = (acc[v] ?? 0) + 1; return acc; }, {});
  const obj = cuenta("fb_obj"), ref = cuenta("fb_ref");
  const tot = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return NextResponse.json({
    votadas: deals.length,
    reconocedor: { ...obj, acierto: tot(obj) ? `${Math.round(((obj.si ?? 0) / tot(obj)) * 100)}%` : "-" },
    referencia: { ...ref, acierto: tot(ref) ? `${Math.round(((ref.ok ?? 0) / tot(ref)) * 100)}%` : "-" },
    fallos: deals.filter((d) => (d.fb_obj && d.fb_obj !== "si") || (d.fb_ref && d.fb_ref !== "ok")).map((d) => `${d.external_id} obj=${d.fb_obj} ref=${d.fb_ref}`),
  });
}
