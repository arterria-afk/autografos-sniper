// Cliente mínimo de Wallapop (API interna de su web). OJO: sus condiciones tampoco permiten el acceso automatizado.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const H = { "user-agent": UA, accept: "application/json", "accept-language": "es-ES,es;q=0.9", "x-deviceos": "0", origin: "https://es.wallapop.com", referer: "https://es.wallapop.com/" };

export class Bloqueado extends Error {}

// Anuncios más nuevos de una búsqueda en toda España (centro en Madrid, radio amplio).
export async function buscar(texto) {
  const u = new URL("https://api.wallapop.com/api/v3/search");
  u.search = new URLSearchParams({ keywords: texto, order_by: "newest", source: "search_box", latitude: "40.4168", longitude: "-3.7038", distance_in_km: "1500" }).toString();
  const r = await fetch(u, { headers: H });
  if (r.status === 403 || r.status === 429) throw new Bloqueado(`Wallapop ${r.status}`);
  if (!r.ok) { console.warn(`búsqueda "${texto}" → ${r.status}`); return []; }
  const items = (await r.json())?.data?.section?.payload?.items ?? [];
  return items
    .filter((i) => !i.reserved?.flag && i.price?.amount > 0)
    .map((i) => ({
      id: i.id, title: i.title, description: i.description ?? "", price: i.price.amount, currency: i.price.currency ?? "EUR",
      url: `https://es.wallapop.com/item/${i.web_slug}`, photo: i.images?.[0]?.urls?.medium ?? null,
      seller: i.user_id ?? null, market: i.location?.country_code ?? "ES",
    }));
}
