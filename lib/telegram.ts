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

// Botones de voto: ✅ bueno · 🤔 dudas · ❌ te has equivocado (→ motivo).
export function botonesVoto(dealId: number, paso: "voto" | "motivo"): Boton[][] {
  if (paso === "voto")
    return [[
      { text: "✅ Bueno", callback_data: `v:${dealId}:bueno` },
      { text: "🤔 Dudas", callback_data: `v:${dealId}:duda` },
      { text: "❌ Te equivocas", callback_data: `v:${dealId}:mal` },
    ]];
  return [
    [{ text: "No es firma real", callback_data: `m:${dealId}:no_firma` }, { text: "No es ese personaje", callback_data: `m:${dealId}:no_personaje` }],
    [{ text: "Precio mal calculado", callback_data: `m:${dealId}:precio` }, { text: "Otro", callback_data: `m:${dealId}:otro` }],
  ];
}

export async function enviarAlerta(opts: { foto?: string | null; html: string; url: string; dealId: number }) {
  const chat_id = process.env.TELEGRAM_CHAT_ID;
  const reply_markup = { inline_keyboard: [[{ text: "Abrir anuncio", url: opts.url }], ...botonesVoto(opts.dealId, "voto")] };
  if (opts.foto) {
    const r = await tg("sendPhoto", { chat_id, photo: opts.foto, caption: opts.html.slice(0, 1024), parse_mode: "HTML", reply_markup });
    if (r.ok) return r.result.message_id as number;
  }
  const r = await tg("sendMessage", { chat_id, text: opts.html, parse_mode: "HTML", reply_markup, link_preview_options: { is_disabled: true } });
  return r.ok ? (r.result.message_id as number) : null;
}
