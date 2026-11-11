// Diagnóstico 2: estructura de la API de Catawiki y detalles de Wallapop.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);
const get = async (url, h = {}) => {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json", "accept-language": "es-ES,es;q=0.9", ...h } });
  return [r.status, await r.text()];
};
const forma = (o, d = 0) =>
  Array.isArray(o) ? `[${o.length}× ${o.length ? forma(o[0], d + 1) : ""}]`
  : o && typeof o === "object" && d < 3 ? `{${Object.keys(o).map((k) => k + ":" + forma(o[k], d + 1)).join(",")}}`
  : typeof o;

// Catawiki
const [s1, b1] = await get("https://www.catawiki.com/buyer/api/v1/search?q=messi");
let j1 = {};
try { j1 = JSON.parse(b1); } catch {}
aviso("cw-forma", `${s1} ${forma(j1)}`);
const lotes = j1.lots ?? j1.results ?? j1.data ?? [];
aviso("cw-lote-0", JSON.stringify(Array.isArray(lotes) ? lotes[0] : j1).slice(0, 3800));
const id = Array.isArray(lotes) && lotes[0] ? (lotes[0].id ?? lotes[0].lot_id) : null;
const urls = [
  "https://www.catawiki.com/buyer/api/v1/search?q=messi&filters=closed",
  id && `https://www.catawiki.com/buyer/api/v3/lots/${id}`,
  id && `https://www.catawiki.com/buyer/api/v1/lots/${id}/bidding`,
].filter(Boolean);
for (const u of urls) {
  const [s, b] = await get(u);
  aviso("cw-" + u.split("/api/")[1].slice(0, 40), `${s} ${b.slice(0, 1500)}`);
}

// Wallapop
const WH = { "x-deviceos": "0", origin: "https://es.wallapop.com", referer: "https://es.wallapop.com/" };
const [s2, b2] = await get("https://api.wallapop.com/api/v3/search?keywords=" + encodeURIComponent("messi firmado") + "&order_by=newest&source=search_box&latitude=40.4168&longitude=-3.7038", WH);
const j2 = JSON.parse(b2);
const items = j2?.data?.section?.payload?.items ?? [];
aviso("wp-forma", `${s2} items=${items.length} meta=${JSON.stringify(j2.meta ?? {})} item=${forma(items[0] ?? {})}`);
aviso("wp-titulos", items.map((i) => `${i.price?.amount}€ ${i.title} [${i.web_slug}]`).join(" ||| "));
const [s3, b3] = await get("https://api.wallapop.com/api/v3/search?keywords=" + encodeURIComponent("messi autografo") + "&order_by=newest&source=search_box&latitude=40.4168&longitude=-3.7038&distance_in_km=1000", WH);
const i3 = JSON.parse(b3)?.data?.section?.payload?.items ?? [];
aviso("wp-1000km", `${s3} items=${i3.length} ${i3.slice(0, 15).map((i) => `${i.price?.amount}€ ${i.title}`).join(" | ")}`);
