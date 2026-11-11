// Lista de variables de entorno que necesita la web.
// "public" = se puede ver en el navegador (solo las NEXT_PUBLIC_).
export const ENV_VARS = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", desc: "Dirección de tu proyecto Supabase", fase: 2 },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", desc: "Clave pública de Supabase", fase: 2 },
  { name: "SUPABASE_SECRET_KEY", desc: "Clave secreta de Supabase (¡nunca pública!)", fase: 2 },
  { name: "TELEGRAM_BOT_TOKEN", desc: "Token del bot de Telegram (@BotFather)", fase: 2 },
  { name: "TELEGRAM_CHAT_ID", desc: "Tu número de chat de Telegram", fase: 2 },
  { name: "ALERT_SECRET", desc: "Contraseña interna entre GitHub Actions y la web", fase: 2 },
  { name: "APP_PASSWORD", desc: "Contraseña para entrar en la web (opcional; si no, usa ALERT_SECRET)", fase: 2, opcional: true },
  { name: "GIXEN_USER", desc: "Usuario de Gixen (solo con Gixen Mirror)", fase: 11, opcional: true },
  { name: "GIXEN_PASS", desc: "Contraseña de Gixen (solo con Gixen Mirror)", fase: 11, opcional: true },
  { name: "EBAY_CLIENT_ID", desc: "App ID de eBay Developers", fase: 4 },
  { name: "EBAY_CLIENT_SECRET", desc: "Cert ID de eBay Developers", fase: 4 },
] as const;

export function envStatus() {
  return (ENV_VARS as readonly { name: string; desc: string; fase: number; opcional?: boolean }[]).map((v) => ({
    ...v,
    opcional: !!v.opcional,
    ok: typeof process.env[v.name] === "string" && process.env[v.name]!.trim() !== "",
  }));
}
