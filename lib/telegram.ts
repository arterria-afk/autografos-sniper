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

// Botones de voto de cada alerta (ver §6 del plano).
export function botonesVoto(dealId: number, paso: 1 | 2): Boton[][] {
  if (paso === 1)
    return [[
      { text: "✅ Es la pieza", callback_data: `fb:${dealId}:obj:si` },
      { text: "🔀 Otra", callback_data: `fb:${dealId}:obj:otro` },
      { text: "📦 Lote/defecto", callback_data: `fb:${dealId}:obj:lote` },
    ]];
  return [
    [
      { text: "👍 Ref. correcta", callback_data: `fb:${dealId}:ref:ok` },
      { text: "📉 Se vende más barato", callback_data: `fb:${dealId}:ref:inflada` },
    ],
    [
      { text: "📈 Se vende más caro", callback_data: `fb:${dealId}:ref:baja` },
      { text: "❓ No encuentro ventas", callback_data: `fb:${dealId}:ref:sin_ventas` },
    ],
  ];
}

export async function enviarAlerta(opts: { foto?: string | null; html: string; url: string; dealId: number }) {
  const chat_id = process.env.TELEGRAM_CHAT_ID;
  const reply_markup = { inline_keyboard: [[{ text: "Abrir anuncio", url: opts.url }], ...botonesVoto(opts.dealId, 1)] };
  if (opts.foto) {
    const r = await tg("sendPhoto", { chat_id, photo: opts.foto, caption: opts.html.slice(0, 1024), parse_mode: "HTML", reply_markup });
    if (r.ok) return r.result.message_id as number;
  }
  const r = await tg("sendMessage", { chat_id, text: opts.html, parse_mode: "HTML", reply_markup, link_preview_options: { is_disabled: true } });
  return r.ok ? (r.result.message_id as number) : null;
}
