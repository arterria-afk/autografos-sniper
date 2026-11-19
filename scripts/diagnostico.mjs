// Diagnóstico 9: ¿qué datos de favoritos / interés dan Vinted y Wallapop?
import * as vinted from "./vinted.mjs";
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 1500)}`);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const pista = (h, re) => [...h.matchAll(re)].slice(0, 4).map((m) => h.slice(Math.max(0, m.index - 80), m.index + 80)).join(" ### ");
const r = await fetch("https://www.vinted.es/catalog?search_text=messi%20firmado&order=newest_first", { headers: { "user-agent": UA, accept: "text/html" } });
const html = await r.text();
aviso("vinted catalogo", `status ${r.status} · ${pista(html, /favou?rite|interest|view_count/gi)}`);
const items = await vinted.buscar("Leo Messi firmado", 1, 0);
if (items[0]) {
  const f = await fetch(items[0].url, { headers: { "user-agent": UA, accept: "text/html" } });
  const h = await f.text();
  aviso("vinted ficha", `status ${f.status} · ${pista(h, /favou?rite_count|view_count|interested|favourites/gi)}`);
}
const u = new URL("https://api.wallapop.com/api/v3/search");
u.search = new URLSearchParams({ keywords: "messi firmado", source: "search_box", latitude: "40.4168", longitude: "-3.7038" }).toString();
const w = await fetch(u, { headers: { "user-agent": UA, "x-deviceos": "0", accept: "application/json" } });
const j = await w.json().catch(() => ({}));
const it = j?.data?.section?.payload?.items?.[0];
aviso("wallapop item", `status ${w.status} · claves ${it ? Object.keys(it).join(",") : "-"}`);
if (it) {
  const d = await fetch(`https://api.wallapop.com/api/v3/items/${it.id}`, { headers: { "user-agent": UA, "x-deviceos": "0", accept: "application/json" } });
  const dj = await d.json().catch(() => ({}));
  aviso("wallapop ficha", `status ${d.status} · claves ${Object.keys(dj).join(",")} · ${JSON.stringify(dj.counters ?? dj.favorites ?? "").slice(0, 400)}`);
}
