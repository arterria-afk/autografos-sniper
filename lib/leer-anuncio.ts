// Saca título, foto y precio de la página de un anuncio (Vinted / Wallapop / eBay) usando sus etiquetas og:.
const PERMITIDOS = [/(^|\.)vinted\.[a-z.]+$/, /(^|\.)wallapop\.com$/, /(^|\.)ebay\.[a-z.]+$/];

export type Anuncio = { titulo: string; foto: string | null; precio: number | null; url: string };

const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, "i"))?.[1] ?? null;

const limpiar = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s*\|\s*(Vinted|Wallapop|eBay).*$/i, "").trim();

export async function leerAnuncio(url: string): Promise<Anuncio | null> {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" || !PERMITIDOS.some((r) => r.test(u.hostname))) return null;
  try {
    const r = await fetch(u, {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36", "accept-language": "es-ES,es;q=0.9" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const titulo = meta(html, "og:title") ?? html.match(/<title>([^<]+)<\/title>/i)?.[1];
    if (!titulo) return null;
    const precio = meta(html, "product:price:amount") ?? meta(html, "og:price:amount");
    return { titulo: limpiar(titulo), foto: meta(html, "og:image"), precio: precio ? Number(precio.replace(",", ".")) : null, url: u.toString() };
  } catch {
    return null;
  }
}
