import { MOTIVOS_DUDA, MOTIVOS_MAL_AUTO } from "./motivos";
const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

type Boton = { text: string; callback_data?: string; url?: string };

export async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.error("Telegram", method, j.description ?? r.status);
  return j;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Botones de voto. Autógrafos: ✅ parece bueno · 🤔 dudas (→ cuál) · ❌ mal (→ por qué).
// Cartas: ✅ carta bien reconocida · ❌ no es esa carta · 👎 no me interesa (sin submenús).
export function botonesVoto(dealId: number, paso: "voto" | "motivo" | "duda", carta = false): Boton[][] {
  if (carta)
    return [[
      { text: "✅ Carta bien", callback_data: `v:${dealId}:bueno` },
      { text: "❌ No es esa carta", callback_data: `m:${dealId}:no_carta` },
      { text: "👎 No me interesa", callback_data: `m:${dealId}:no_interesa` },
    ]];
  if (paso === "voto")
    return [[
      { text: "✅ Parece bueno", callback_data: `v:${dealId}:bueno` },
      { text: "🤔 Dudas", callback_data: `v:${dealId}:duda` },
      { text: "❌ Mal", callback_data: `v:${dealId}:mal` },
    ]];
  const fila = (m: Record<string, string>, pre: string) => Object.entries(m).map(([k, t]) => ({ text: t, callback_data: `${pre}:${dealId}:${k}` }));
  const bs = paso === "duda" ? fila(MOTIVOS_DUDA, "d") : fila(MOTIVOS_MAL_AUTO, "m");
  return [bs.slice(0, 2), bs.slice(2)];
}

export async function enviarAlerta(opts: { foto?: string | null; html: string; url: string; dealId: number; carta?: boolean }) {
  const chat_id = process.env.TELEGRAM_CHAT_ID;
  const reply_markup = { inline_keyboard: [[{ text: "Abrir anuncio", url: opts.url }], ...botonesVoto(opts.dealId, "voto", opts.carta)] };
  if (opts.foto) {
    const r = await tg("sendPhoto", { chat_id, photo: opts.foto, caption: opts.html.slice(0, 1024), parse_mode: "HTML", reply_markup });
    if (r.ok) return r.result.message_id as number;
  }
  const r = await tg("sendMessage", { chat_id, text: opts.html, parse_mode: "HTML", reply_markup, link_preview_options: { is_disabled: true } });
  return r.ok ? (r.result.message_id as number) : null;
}
