import { NextResponse } from "next/server";
import { webhookValido } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { botonesVoto, tg } from "@/lib/telegram";

const RESPUESTA: Record<string, string> = {
  si: "Anotado: es la pieza", otro: "Anotado: otra pieza", lote: "Anotado: lote/defecto",
  ok: "Anotado: referencia correcta", inflada: "Anotado: referencia inflada",
  baja: "Anotado: referencia baja", sin_ventas: "Anotado: sin ventas",
};

export async function POST(req: Request) {
  if (!webhookValido(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const u = await req.json();
  const q = u.callback_query;
  if (!q) return NextResponse.json({ ok: true });

  // Solo el dueño puede votar.
  if (String(q.message?.chat?.id) !== String(process.env.TELEGRAM_CHAT_ID)) {
    await tg("answerCallbackQuery", { callback_query_id: q.id });
    return NextResponse.json({ ok: true });
  }

  const [, id, campo, valor] = String(q.data ?? "").split(":");
  const dealId = Number(id);
  if (!dealId || !["obj", "ref"].includes(campo)) return NextResponse.json({ ok: true });

  await db().from("deals").update({ [campo === "obj" ? "fb_obj" : "fb_ref"]: valor, feedback_at: new Date().toISOString() }).eq("id", dealId);

  // Si es la pieza y tiene referencia, pasamos a la 2.ª pregunta; si no, quitamos los botones.
  const { data: deal } = await db().from("deals").select("ref_price").eq("id", dealId).single();
  const abrir = q.message.reply_markup?.inline_keyboard?.[0] ?? [];
  const siguiente = campo === "obj" && valor === "si" && deal?.ref_price ? botonesVoto(dealId, 2) : [];
  await tg("editMessageReplyMarkup", {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    reply_markup: { inline_keyboard: [abrir, ...siguiente] },
  });
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: RESPUESTA[valor] ?? "Anotado" });
  return NextResponse.json({ ok: true });
}
