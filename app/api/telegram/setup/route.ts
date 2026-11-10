import { NextResponse } from "next/server";
import { autorizado, telegramWebhookSecret } from "@/lib/auth";
import { tg } from "@/lib/telegram";

// Conecta el bot con la web. Se llama una vez (workflow "admin", acción setup).
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const origin = new URL(req.url).origin;
  const r = await tg("setWebhook", {
    url: `${origin}/api/telegram/webhook`,
    secret_token: telegramWebhookSecret(),
    allowed_updates: ["callback_query"],
  });
  await tg("sendMessage", { chat_id: process.env.TELEGRAM_CHAT_ID, text: "✅ Bot conectado con la web. Aquí te llegarán las alertas." });
  return NextResponse.json(r);
}
