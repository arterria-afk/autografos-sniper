import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db, fetchAll } from "@/lib/supabase";

export const maxDuration = 60;

// Estadísticas internas para diagnosticar: qué se guarda, cuántas ventas reales hay y cuántas referencias de precio son posibles.
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  type L = { platform: string; kind: string | null; status: string; seen_at: string; sold_at: string | null; con_certificado: boolean; personaje_id: string; tipo: string; carta_clave: string | null };
  const filas = await fetchAll<L>(async (a, b) => {
    const { data, error } = await db().from("listings").select("platform,kind,status,seen_at,sold_at,con_certificado,personaje_id,tipo,carta_clave").range(a, b);
    return { data: data as L[] | null, error };
  });
  const hace = (d: number) => Date.now() - d * 864e5;
  const cuenta = (f: (l: L) => boolean) => filas.filter(f).length;
  const porGrupo = (f: (l: L) => boolean, k: (l: L) => string) =>
    filas.filter(f).reduce<Record<string, number>>((a, l) => { a[k(l)] = (a[k(l)] ?? 0) + 1; return a; }, {});

  const vendidas = (l: L) => l.status === "vendido";
  const ventasCarta = porGrupo((l) => vendidas(l) && l.kind === "carta" && !!l.carta_clave, (l) => l.carta_clave!);
  const ventasAuto = porGrupo((l) => vendidas(l) && l.kind !== "carta" && l.con_certificado, (l) => `${l.personaje_id}|${l.tipo}`);
  const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const { count: deals7 } = await db().from("deals").select("id", { count: "exact", head: true }).gte("created_at", new Date(hace(7)).toISOString());
  const { count: chollos7 } = await db().from("deals").select("id", { count: "exact", head: true }).gte("created_at", new Date(hace(7)).toISOString()).eq("es_chollo", true);
  const { count: conRef7 } = await db().from("deals").select("id", { count: "exact", head: true }).gte("created_at", new Date(hace(7)).toISOString()).not("ref_price", "is", null);

  return NextResponse.json({
    total: filas.length,
    por_plataforma_tipo_estado: porGrupo(() => true, (l) => `${l.platform}|${l.kind ?? "autografo"}|${l.status}`),
    nuevos_24h: porGrupo((l) => new Date(l.seen_at).getTime() > hace(1), (l) => `${l.platform}|${l.kind ?? "autografo"}`),
    nuevos_7d: porGrupo((l) => new Date(l.seen_at).getTime() > hace(7), (l) => `${l.platform}|${l.kind ?? "autografo"}`),
    vendidos_7d: porGrupo((l) => vendidas(l) && !!l.sold_at && new Date(l.sold_at).getTime() > hace(7), (l) => `${l.platform}|${l.kind ?? "autografo"}`),
    borrados_total: cuenta((l) => l.status === "borrado"),
    referencias_cartas: { claves_con_ventas: Object.keys(ventasCarta).length, claves_con_2_o_mas: Object.values(ventasCarta).filter((n) => n >= 2).length, top: top(ventasCarta) },
    referencias_autografos: { grupos_con_ventas: Object.keys(ventasAuto).length, grupos_con_2_o_mas: Object.values(ventasAuto).filter((n) => n >= 2).length, top: top(ventasAuto) },
    alertas_7d: { candidatos: deals7, con_referencia: conRef7, chollos: chollos7 },
  });
}
