import { NextResponse } from "next/server";
import { envStatus } from "@/lib/env";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Comprueba si existen las tablas/columnas de cada migración (sin enseñar datos).
async function migraciones() {
  try {
    const ok = async (tabla: string, cols: string) => !(await db().from(tabla).select(cols).limit(1)).error;
    return {
      "001_inicial": await ok("listings", "id") && await ok("deals", "id") && await ok("snipes", "id"),
      "002_negocio_y_votos": await ok("listings", "seller,descartado,descripcion") && await ok("deals", "fb,fb_motivo") && await ok("inventario", "id") && await ok("vendedores_bloqueados", "seller"),
      "003_ia": await ok("deals", "ia,ia_descartado"),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Dice qué variables faltan, SIN enseñar nunca su valor, y qué migraciones están aplicadas.
export async function GET() {
  const vars = envStatus();
  const missing = vars.filter((v) => !v.ok && !v.opcional).map((v) => v.name);
  return NextResponse.json({
    ok: missing.length === 0,
    configuradas: vars.filter((v) => v.ok).map((v) => v.name),
    faltan: missing,
    migraciones: await migraciones(),
    hora: new Date().toISOString(),
  });
}
