// Todos los enlaces de eBay a ebay.com (el número de artículo es el mismo en todos los países).
export const enlace = (u: string | null | undefined): string =>
  (u ?? "").replace(/^https?:\/\/(www\.)?ebay\.[a-z.]+\/itm\//i, "https://www.ebay.com/itm/");
