import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { tg } from "@/lib/telegram";
import { personajes } from "@/lib/personajes";

// Resumen diario por Telegram: novedades certificadas de las últimas 24 h (que no se avisaron una a una).
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const desde = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { data } = await db().from("deals")
    .select("es_chollo,price,listings!inner(personaje_id,platform,descartado)")
    .gte("created_at", desde).eq("listings.descartado", false).limit(1000);
  const filas = (data ?? []) as unknown as { es_chollo: boolean; price: number; listings: { personaje_id: string; platform: string } }[];
  const nov = filas.filter((d) => !d.es_chollo), chollos = filas.length - nov.length;
  const { count: revisados } = await db().from("listings").select("id", { count: "exact", head: true }).gte("last_seen_at", desde);

  const porPersonaje = Object.entries(nov.reduce<Record<string, number>>((a, d) => { a[d.listings.personaje_id] = (a[d.listings.personaje_id] ?? 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]).map(([id, n]) => `${personajes().find((p) => p.id === id)?.nombre ?? id} (${n})`);
  const web = new URL(req.url).origin;
  const texto = [
    "📋 <b>Resumen del día</b>",
    `🔎 ${revisados ?? 0} anuncios revisados`,
    `🔥 ${chollos} chollos (ya avisados)`,
    `🆕 ${nov.length} novedades certificadas${porPersonaje.length ? ": " + porPersonaje.join(", ") : ""}`,
    nov.length ? `👉 <a href="${web}/chollos">Ver en la web</a>` : "",
  ].filter(Boolean).join("\n");
  await tg("sendMessage", { chat_id: process.env.TELEGRAM_CHAT_ID, text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  return NextResponse.json({ ok: true, revisados, chollos, novedades: nov.length });
}
