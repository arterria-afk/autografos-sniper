import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { tg } from "@/lib/telegram";
import { nombreDe } from "@/lib/personajes";

// Resumen diario por Telegram: novedades certificadas de las últimas 24 h (que no se avisaron una a una).
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  // ?horas=N: periodo que cubre (10:00 → desde las 17:00 de ayer = 17 h; 17:00 → desde las 10:00 = 7 h).
  const horas = Math.min(Math.max(Number(new URL(req.url).searchParams.get("horas") ?? 24), 1), 48);
  const desde = new Date(Date.now() - horas * 3600e3).toISOString();
  const titulo = new URL(req.url).searchParams.get("titulo") ?? "Resumen del día";
  const { data } = await db().from("deals")
    .select("es_chollo,price,listings!inner(personaje_id,platform,descartado)")
    .gte("created_at", desde).eq("listings.descartado", false).limit(1000);
  const filas = (data ?? []) as unknown as { es_chollo: boolean; price: number; listings: { personaje_id: string; platform: string } }[];
  const nov = filas.filter((d) => !d.es_chollo), chollos = filas.length - nov.length;
  const { count: revisados } = await db().from("listings").select("id", { count: "exact", head: true }).gte("last_seen_at", desde);

  const porPersonaje = Object.entries(nov.reduce<Record<string, number>>((a, d) => { a[d.listings.personaje_id] = (a[d.listings.personaje_id] ?? 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]).map(([id, n]) => `${nombreDe(id)} (${n})`);
  const web = new URL(req.url).origin;

  // Oportunidades sin ventas confirmadas: muy por debajo de lo que piden otros vendedores por lo mismo (≥ 35 %).
  const { data: ops } = await db().from("deals")
    .select("price,ref_price,descuento,listings!inner(title,url,platform,descartado,status)")
    .gte("created_at", desde).eq("ref_source", "en_venta").gte("descuento", 35).eq("listings.descartado", false).eq("listings.status", "activo")
    .order("descuento", { ascending: false }).limit(5);
  const oportunidades = (ops ?? []) as unknown as { price: number; ref_price: number; descuento: number; listings: { title: string; url: string; platform: string } }[];
  const texto = [
    `📋 <b>${titulo}</b> (últimas ${horas} h)`,
    `🔎 ${revisados ?? 0} anuncios revisados`,
    `🔥 ${chollos} chollos (ya avisados)`,
    `🆕 ${nov.length} novedades (autógrafos certificados y cartas)${porPersonaje.length ? ": " + porPersonaje.join(", ") : ""}`,
    nov.length ? `👉 <a href="${web}/chollos">Ver en la web</a>` : "",
    ...(oportunidades.length ? [
      "",
      "💡 <b>Posibles chollos</b> (sin ventas confirmadas: más baratos que lo que piden otros vendedores):",
      ...oportunidades.map((o) => `• −${o.descuento}% · <b>${o.price} €</b> (otros piden ~${o.ref_price} €) · <a href="${o.listings.url}">${o.listings.title.replace(/[<>&]/g, "").slice(0, 60)}</a> (${o.listings.platform})`),
      `👉 <a href="${web}/chollos?solo=oport">Ver todas</a>`,
    ] : []),
  ].filter(Boolean).join("\n");
  await tg("sendMessage", { chat_id: process.env.TELEGRAM_CHAT_ID, text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  return NextResponse.json({ ok: true, revisados, chollos, novedades: nov.length });
}
