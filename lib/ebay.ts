// eBay Browse API (oficial, gratis ~5.000 llamadas/día). Claves en Vercel: EBAY_CLIENT_ID / EBAY_CLIENT_SECRET.
import type { Item } from "./ingesta";

export const ebayActivo = () => !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);

export const MERCADOS: Record<string, { moneda: string; dominio: string }> = {
  EBAY_ES: { moneda: "EUR", dominio: "ebay.es" },
  EBAY_DE: { moneda: "EUR", dominio: "ebay.de" },
  EBAY_GB: { moneda: "GBP", dominio: "ebay.co.uk" },
  EBAY_US: { moneda: "USD", dominio: "ebay.com" },
};

// ---------- token de aplicación (client credentials), válido ~2 h ----------
let token: { valor: string; hasta: number } | null = null;
async function tokenApp(): Promise<string> {
  if (token && Date.now() < token.hasta) return token.valor;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`eBay token ${r.status}: ${j.error_description ?? j.error ?? "sin detalle"}`);
  token = { valor: j.access_token, hasta: Date.now() + (Number(j.expires_in ?? 7200) - 300) * 1000 };
  return token.valor;
}

// ---------- cambio de moneda a EUR (BCE vía frankfurter.app; si falla, valores aproximados) ----------
let cambio: { tasas: Record<string, number>; hasta: number } | null = null;
async function aEUR(moneda: string): Promise<number> {
  if (moneda === "EUR") return 1;
  if (!cambio || Date.now() > cambio.hasta) {
    try {
      const j = await (await fetch("https://api.frankfurter.app/latest?to=EUR&from=USD", { signal: AbortSignal.timeout(5000) })).json();
      const g = await (await fetch("https://api.frankfurter.app/latest?to=EUR&from=GBP", { signal: AbortSignal.timeout(5000) })).json();
      cambio = { tasas: { USD: j.rates.EUR, GBP: g.rates.EUR }, hasta: Date.now() + 12 * 3600e3 };
    } catch {
      cambio = { tasas: { USD: 0.92, GBP: 1.17 }, hasta: Date.now() + 3600e3 };
    }
  }
  return cambio.tasas[moneda] ?? 1;
}

// ---------- "destraducir": eBay ES/DE traduce los títulos automáticamente ----------
const DESTRADUCIR: [RegExp, string][] = [
  [/\bcromo\b(?=.*\b(topps|refractor|ucc|uefa)\b)|\b(?<=topps )cromo\b/gi, "chrome"],
  [/\bnovato\b|\bneuling\b|\brookie-?karte\b/gi, "rookie"],
  [/\bzafiro\b|\bsaphir\b/gi, "sapphire"],
  [/\brefractores?\b|\brefraktor\b/gi, "refractor"],
  [/\boro\b/gi, "gold"], [/\brojo\b|\brot\b/gi, "red"], [/\bazul\b|\bblau\b/gi, "blue"], [/\bverde\b|\bgrün\b/gi, "green"],
  [/\bnaranja\b/gi, "orange"], [/\bmorado\b|\bpúrpura\b|\blila\b/gi, "purple"], [/\bnegro\b|\bschwarz\b/gi, "black"],
  [/\brosa\b/gi, "pink"], [/\bplata\b|\bsilber\b/gi, "silver"], [/\bonda\b|\bwelle\b/gi, "wave"],
  [/\bautógrafo\b|\bautogramm\b/gi, "auto"], [/\bfirmado\b|\bsigniert\b/gi, "signed"],
];
export function destraducir(t: string): string {
  return DESTRADUCIR.reduce((s, [re, por]) => s.replace(re, por), t);
}

type Resumen = {
  itemId: string; legacyItemId?: string; title: string; itemWebUrl: string; buyingOptions?: string[];
  price?: { value: string; currency: string }; currentBidPrice?: { value: string; currency: string };
  image?: { imageUrl: string }; seller?: { username: string }; itemLocation?: { country?: string }; itemEndDate?: string;
};

// Busca los anuncios más nuevos en un mercado. min = precio mínimo en la moneda del mercado.
export async function buscarEbay(q: string, mercado = "EBAY_ES", min = 0): Promise<Item[]> {
  const m = MERCADOS[mercado] ?? MERCADOS.EBAY_ES;
  const filtros = ["buyingOptions:{FIXED_PRICE|AUCTION|BEST_OFFER}"];
  if (min > 0) filtros.push(`price:[${min}..]`, `priceCurrency:${m.moneda}`);
  const u = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  u.search = new URLSearchParams({ q, limit: "100", sort: "newlyListed", filter: filtros.join(",") }).toString();
  const r = await fetch(u, { headers: { authorization: `Bearer ${await tokenApp()}`, "X-EBAY-C-MARKETPLACE-ID": mercado } });
  if (r.status === 401) { token = null; throw new Error("eBay 401: token caducado o claves sin permiso"); }
  if (!r.ok) throw new Error(`eBay ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { itemSummaries?: Resumen[] };

  const out: Item[] = [];
  for (const s of j.itemSummaries ?? []) {
    const subasta = !!s.buyingOptions?.includes("AUCTION") && !s.buyingOptions?.includes("FIXED_PRICE");
    const p = subasta ? (s.currentBidPrice ?? s.price) : s.price;
    if (!p) continue;
    const eur = Math.round(Number(p.value) * (await aEUR(p.currency)) * 100) / 100;
    const id = s.legacyItemId ?? s.itemId.split("|")[1] ?? s.itemId;
    out.push({
      id, title: s.title, tituloReconocer: destraducir(s.title), price: eur, currency: "EUR",
      url: `https://www.${m.dominio}/itm/${id}`, photo: s.image?.imageUrl ?? null,
      seller: s.seller?.username ?? null, market: s.itemLocation?.country ?? mercado.replace("EBAY_", ""), subasta,
    });
  }
  return out;
}
