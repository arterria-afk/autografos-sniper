import { createHash, timingSafeEqual } from "node:crypto";

function igual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Las llamadas de GitHub Actions llevan la cabecera x-alert-secret.
export function autorizado(req: Request): boolean {
  const s = process.env.ALERT_SECRET;
  const h = req.headers.get("x-alert-secret");
  return !!s && !!h && igual(s, h);
}

// Secreto que Telegram nos devuelve en cada webhook (derivado de ALERT_SECRET).
export function telegramWebhookSecret(): string {
  return createHash("sha256").update("tg:" + (process.env.ALERT_SECRET ?? "")).digest("hex").slice(0, 48);
}
export function webhookValido(req: Request): boolean {
  const h = req.headers.get("x-telegram-bot-api-secret-token");
  return !!process.env.ALERT_SECRET && !!h && igual(h, telegramWebhookSecret());
}
