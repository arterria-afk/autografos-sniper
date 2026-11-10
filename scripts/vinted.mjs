// Cliente mínimo de Vinted. OJO: Vinted prohíbe el acceso automatizado en sus condiciones.
import { dormir } from "./comun.mjs";

const BASE = process.env.VINTED_BASE ?? "https://www.vinted.es";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
let cookies = "";

export class Bloqueado extends Error {}

async function sesion() {
  const r = await fetch(BASE + "/", { headers: { "user-agent": UA, "accept-language": "es-ES,es;q=0.9" } });
  if (r.status === 403 || r.status === 429) throw new Bloqueado(`Vinted ${r.status} en portada`);
  cookies = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

async function get(url, accept = "application/json") {
  if (!cookies) await sesion();
  for (let intento = 0; intento < 2; intento++) {
    const r = await fetch(url, { headers: { "user-agent": UA, accept, "accept-language": "es-ES,es;q=0.9", cookie: cookies } });
    if (r.status === 401 && intento === 0) { await sesion(); continue; }
    if (r.status === 403 || r.status === 429) throw new Bloqueado(`Vinted ${r.status}`);
    return r;
  }
}

// Si Vinted bloquea: parar 30 minutos, no insistir.
export async function conFreno(fn) {
  try { return await fn(); }
  catch (e) {
    if (e instanceof Bloqueado) { console.warn(`${e.message} → pausa de 30 min`); cookies = ""; await dormir(30 * 60e3); return null; }
    throw e;
  }
}

const precio = (p) => (p && typeof p === "object" ? Number(p.amount) : Number(p));

// Anuncios más nuevos de una búsqueda.
export async function buscar(texto, page = 1) {
  const u = new URL(BASE + "/api/v2/catalog/items");
  u.search = new URLSearchParams({ search_text: texto, order: "newest_first", per_page: "96", page: String(page) }).toString();
  const r = await get(u.toString());
  if (!r.ok) { console.warn(`búsqueda "${texto}" → ${r.status}`); return []; }
  const j = await r.json();
  return (j.items ?? []).map((it) => ({
    id: it.id, title: it.title, price: precio(it.price), currency: it.price?.currency_code ?? it.currency ?? "EUR",
    url: it.url?.startsWith("http") ? it.url : BASE + (it.url ?? `/items/${it.id}`),
    photo: it.photo?.url ?? it.photo?.full_size_url ?? null, market: "ES",
  }));
}

// Estado de un anuncio desde su página: vendido / reservado / borrado / activo.
export async function estado(url) {
  const r = await get(url, "text/html");
  if (r.status === 404 || r.status === 410) return { estado: "borrado" };
  if (!r.ok) return null;
  const html = await r.text();
  const flag = (k) => { const m = html.match(new RegExp(`\\\\?"${k}\\\\?"\\s*:\\s*(true|false)`)); return m ? m[1] === "true" : null; };
  const foto = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] ?? null;
  const canBuy = flag("can_buy"), reservado = flag("is_reserved"), oculto = flag("is_hidden"), cerrado = flag("is_closed");
  if (cerrado || (canBuy === false && !reservado && !oculto)) return { estado: "vendido", photo: foto ? Buffer.from(foto).toString() : null };
  if (reservado) return { estado: "reservado" };
  return { estado: "activo" };
}
