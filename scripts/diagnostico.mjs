// Diagnóstico 4: ¿se detectan ventas en Wallapop? ¿Responde PSA (precios y certificados) sin IA?
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WH = { "user-agent": UA, accept: "application/json", "accept-language": "es-ES,es;q=0.9", "x-deviceos": "0", origin: "https://es.wallapop.com", referer: "https://es.wallapop.com/" };
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);
const forma = (o, d = 0) =>
  Array.isArray(o) ? `[${o.length}× ${o.length ? forma(o[0], d + 1) : ""}]`
  : o && typeof o === "object" && d < 2 ? `{${Object.keys(o).map((k) => k + ":" + forma(o[k], d + 1)).join(",")}}`
  : typeof o === "boolean" || typeof o === "number" ? String(o) : typeof o;
const get = async (url, h) => { const r = await fetch(url, { headers: h, redirect: "follow" }); return [r.status, await r.text(), r.url]; };

// 1) Wallapop: buscar un anuncio y pedir su ficha
const u = new URL("https://api.wallapop.com/api/v3/search");
u.search = new URLSearchParams({ keywords: "lamine yamal topps", source: "search_box", latitude: "40.4168", longitude: "-3.7038", min_sale_price: "25" }).toString();
const [s0, b0] = await get(u, WH);
const items = JSON.parse(b0)?.data?.section?.payload?.items ?? [];
aviso("wp-busqueda-min25", `${s0} n=${items.length} precios=${items.slice(0, 15).map((i) => i.price?.amount).join(",")} · ${items.slice(0, 8).map((i) => i.title).join(" | ")}`);
const it = items[0];
if (it) {
  for (const url of [`https://api.wallapop.com/api/v3/items/${it.id}`, `https://api.wallapop.com/api/v3/items/${it.id}/vertical`]) {
    const [s, b] = await get(url, WH);
    let f = b.slice(0, 300);
    try { f = forma(JSON.parse(b)); } catch {}
    aviso("wp-item " + url.split("/items/")[1], `${s} ${f}`.slice(0, 3800));
  }
  const [s404] = await get("https://api.wallapop.com/api/v3/items/zzzzzzzzzzzz", WH);
  aviso("wp-item-inexistente", String(s404));
  const [sw, bw] = await get(`https://es.wallapop.com/item/${it.web_slug}`, { "user-agent": UA, accept: "text/html" });
  aviso("wp-web-item", `${sw} largo=${bw.length} sold=${(bw.match(/"sold"|vendido|is_sold|"flags"/gi) ?? []).slice(0, 5).join(",")}`);
}

// 2) PSA: registro de ventas (Auction Prices Realized), certificados y API pública
for (const [n, url] of [
  ["psa-apr-buscar", "https://www.psacard.com/auctionprices/search?q=" + encodeURIComponent("lamine yamal")],
  ["psa-apr-portada", "https://www.psacard.com/auctionprices"],
  ["psa-cert", "https://www.psacard.com/cert/80000000"],
  ["psa-api", "https://api.psacard.com/publicapi/cert/GetByCertNumber/80000000"],
]) {
  try {
    const [s, b, final] = await get(url, { "user-agent": UA, accept: "text/html,application/json", "accept-language": "es-ES,es;q=0.9" });
    aviso(n, `${s} ${final} largo=${b.length} titulo=${b.match(/<title>([^<]{0,90})/)?.[1] ?? ""} cloudflare=${/just a moment|cf-chl|challenge-platform/i.test(b)} inicio=${b.slice(0, 200).replace(/\s+/g, " ")}`);
  } catch (e) { aviso(n, "ERROR " + e.message); }
  await new Promise((s) => setTimeout(s, 2000));
}
