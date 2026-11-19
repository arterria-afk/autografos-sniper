import { NextResponse } from "next/server";
import { webhookValido } from "@/lib/auth";
import { botonesVoto, tg } from "@/lib/telegram";
import { MOTIVOS, MOTIVOS_DUDA, registrarVoto, type Motivo, type MotivoDuda, type Voto } from "@/lib/votos";

const TXT: Record<Voto, string> = { bueno: "✅ Anotado: bueno", duda: "🤔 ¿Qué duda tienes?", mal: "❌ ¿Por qué?" };

export async function POST(req: Request) {
  if (!webhookValido(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const q = (await req.json()).callback_query;
  if (!q) return NextResponse.json({ ok: true });
  if (String(q.message?.chat?.id) !== String(process.env.TELEGRAM_CHAT_ID)) {
    await tg("answerCallbackQuery", { callback_query_id: q.id });
    return NextResponse.json({ ok: true });
  }

  const [tipo, id, valor] = String(q.data ?? "").split(":");
  const dealId = Number(id);
  const abrir = q.message.reply_markup?.inline_keyboard?.[0] ?? [];
  const editar = (filas: unknown[][]) =>
    tg("editMessageReplyMarkup", { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [abrir, ...filas] } });

  if (tipo === "v" && dealId && ["bueno", "duda", "mal"].includes(valor)) {
    const v = valor as Voto;
    if (v === "mal") await editar(botonesVoto(dealId, "motivo"));
    else if (v === "duda") await editar(botonesVoto(dealId, "duda"));
    else { await registrarVoto(dealId, v); await editar([[{ text: TXT[v], callback_data: `v:${dealId}:${v}` }]]); }
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: TXT[v] });
  } else if (tipo === "d" && dealId && valor in MOTIVOS_DUDA) {
    await registrarVoto(dealId, "duda", valor as MotivoDuda);
    await editar([[{ text: `🤔 ${MOTIVOS_DUDA[valor as MotivoDuda]}`, callback_data: `v:${dealId}:duda` }]]);
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Anotado. Lo verás en la web → Chollos → 🤔" });
  } else if (tipo === "m" && dealId && valor in MOTIVOS) {
    await registrarVoto(dealId, "mal", valor as Motivo);
    await editar([[{ text: `❌ ${MOTIVOS[valor as Motivo]}`, callback_data: `v:${dealId}:mal` }]]);
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Anotado. No volverá a salir." });
  } else {
    await tg("answerCallbackQuery", { callback_query_id: q.id });
  }
  return NextResponse.json({ ok: true });
}
