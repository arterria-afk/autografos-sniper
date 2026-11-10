// Utilidades compartidas por los scripts de GitHub Actions.
import { readFileSync } from "node:fs";

export const SITE = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.ALERT_SECRET ?? "";
if (!SITE || !SECRET) { console.error("Faltan SITE_URL o ALERT_SECRET"); process.exit(1); }

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// 4–7 s + algo aleatorio entre peticiones a Vinted (evita el 429).
export const pausa = () => dormir(4000 + Math.random() * 3000);

export async function web(path, body) {
  const r = await fetch(SITE + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-alert-secret": SECRET },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path} → ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

export function personajes() {
  return readFileSync("data/personajes.txt", "utf8").split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#")).map((l) => { const [id, nombre] = l.split("|").map((x) => x.trim()); return { id, nombre }; });
}

// Bucle: repite una pasada cada EVERY_MINUTES durante LOOP_MINUTES (el cron de GitHub se retrasa).
export async function bucle(pasada) {
  const loop = Number(process.env.LOOP_MINUTES ?? 0), every = Number(process.env.EVERY_MINUTES ?? 15);
  const fin = Date.now() + loop * 60e3;
  do {
    const t0 = Date.now();
    try { await pasada(); } catch (e) { console.error("Error en la pasada:", e.message); }
    const espera = every * 60e3 - (Date.now() - t0);
    if (Date.now() + espera >= fin) break;
    console.log(`Esperando ${Math.round(espera / 60e3)} min…`);
    await dormir(espera);
  } while (true);
}
