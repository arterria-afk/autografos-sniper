// Cliente mínimo de Wallapop (API interna de su web). OJO: sus condiciones tampoco permiten el acceso automatizado.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const H = { "user-agent": UA, accept: "application/json", "accept-language": "es-ES,es;q=0.9", "x-deviceos": "0", origin: "https://es.wallapop.com", referer: "https://es.wallapop.com/" };

export class Bloqueado extends Error {}

// Búsqueda por relevancia (con "más nuevos" Wallapop deja de filtrar por palabra).
// Las novedades se detectan igual: la web sabe qué anuncios ya ha visto. Lee hasta PAGINAS páginas (~40 c/u).
export async function buscar(texto, paginas = 2) {
  const items = [];
  let next = null;
  for (let p = 0; p < paginas; p++) {
    const u = new URL("https://api.wallapop.com/api/v3/search");
    u.search = new URLSearchParams(next ? { next_page: next } : { keywords: texto, source: "search_box", latitude: "40.4168", longitude: "-3.7038" }).toString();
    const r = await fetch(u, { headers: H });
    if (r.status === 403 || r.status === 429) throw new Bloqueado(`Wallapop ${r.status}`);
    if (!r.ok) { console.warn(`búsqueda "${texto}" → ${r.status}`); break; }
    const j = await r.json();
    items.push(...(j?.data?.section?.payload?.items ?? []));
    next = j?.meta?.next_page;
    if (!next) break;
    await new Promise((s) => setTimeout(s, 2500 + Math.random() * 2000));
  }
  return items
    .filter((i) => !i.reserved?.flag && i.price?.amount > 0)
    .map((i) => ({
      id: i.id, title: i.title, description: i.description ?? "", price: i.price.amount, currency: i.price.currency ?? "EUR",
      url: `https://es.wallapop.com/item/${i.web_slug}`, photo: i.images?.[0]?.urls?.medium ?? null,
      seller: i.user_id ?? null, market: i.location?.country_code ?? "ES",
    }));
}
