// Cliente mínimo de Vinted. OJO: Vinted prohíbe el acceso automatizado en sus condiciones.
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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

const ent = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const euros = (t) => { const m = t?.match(/([\d.]+(?:,\d+)?)\s*€/); return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null; };

// El atributo title trae "Título, Marca: X, Estado: Y, Talla: Z, 27.00 €, 29.05 €" → nos quedamos con el título.
export function limpiarTitulo(t) {
  const corte = t.search(/, (Marca|Estado|Talla|Brand|Condition|Size):/);
  return (corte > 0 ? t.slice(0, corte) : t.replace(/(, [\d.,]+ €)+$/, "")).trim();
}

// Lee los anuncios de la página de resultados (HTML).
export function parsearCatalogo(html) {
  const out = [], vistos = new Set();
  for (const m of html.matchAll(/<a [^>]*product-item-id-(\d+)--overlay-link[^>]*>/g)) {
    const id = m[1], tag = m[0];
    if (vistos.has(id)) continue;
    vistos.add(id);
    const title = tag.match(/ title="([^"]*)"/)?.[1];
    const href = tag.match(/ href="([^"]*)"/)?.[1];
    if (!title || !href) continue;
    const img = html.match(new RegExp(`<img [^>]*src="([^"]+)"[^>]*product-item-id-${id}--image--img`))?.[1] ?? null;
    const precioTxt = html.match(new RegExp(`product-item-id-${id}--price-text">([^<]+)<`))?.[1];
    const price = euros(precioTxt ?? "") ?? euros(title);
    if (price == null) continue;
    out.push({
      id, title: limpiarTitulo(ent(title)), price, currency: "EUR",
      url: BASE + ent(href).replace(/\?.*$/, ""), photo: img ? ent(img) : null, market: "ES",
    });
  }
  return out;
}

// Anuncios más nuevos de una búsqueda (página de resultados, como haría una persona).
export async function buscar(texto, page = 1, min = 0) {
  const u = new URL(BASE + "/catalog");
  u.search = new URLSearchParams({ search_text: texto, order: "newest_first", ...(min > 0 ? { price_from: String(min) } : {}), ...(page > 1 ? { page: String(page) } : {}) }).toString();
  const r = await get(u.toString(), "text/html");
  if (!r.ok) { console.warn(`búsqueda "${texto}" → ${r.status}`); return []; }
  return parsearCatalogo(await r.text());
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
