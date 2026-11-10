import { NextResponse } from "next/server";
import { envStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

// Dice qué variables faltan, SIN enseñar nunca su valor.
export function GET() {
  const vars = envStatus();
  const missing = vars.filter((v) => !v.ok).map((v) => v.name);
  return NextResponse.json({
    ok: missing.length === 0,
    configuradas: vars.filter((v) => v.ok).map((v) => v.name),
    faltan: missing,
    hora: new Date().toISOString(),
  });
}
