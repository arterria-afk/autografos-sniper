// Diagnóstico 3: ¿qué parámetros de búsqueda de Wallapop traen autógrafos de verdad?
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const H = { "user-agent": UA, accept: "application/json", "accept-language": "es-ES,es;q=0.9", "x-deviceos": "0", origin: "https://es.wallapop.com", referer: "https://es.wallapop.com/" };
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);

async function probar(nombre, params) {
  const u = new URL("https://api.wallapop.com/api/v3/search");
  u.search = new URLSearchParams({ source: "search_box", latitude: "40.4168", longitude: "-3.7038", ...params }).toString();
  const r = await fetch(u, { headers: H });
  const j = await r.json().catch(() => ({}));
  const items = j?.data?.section?.payload?.items ?? [];
  aviso(nombre, `${r.status} n=${items.length} next=${!!j?.meta?.next_page} · ` + items.slice(0, 12).map((i) => `${i.price?.amount}€ ${i.title}`).join(" | "));
  await new Promise((s) => setTimeout(s, 2500));
}

await probar("newest", { keywords: "messi firmado", order_by: "newest" });
await probar("relevancia", { keywords: "messi firmado", order_by: "most_relevance" });
await probar("sin-orden", { keywords: "messi firmado" });
await probar("newest-sin-dist", { keywords: "messi autografo", order_by: "newest" });
await probar("relev-dist", { keywords: "messi autografo", order_by: "most_relevance", distance_in_km: "1000" });
await probar("leo-messi-firmada", { keywords: "camiseta firmada messi" });
await probar("kobe-signed", { keywords: "kobe bryant signed" });
await probar("categoria-coleccionismo", { keywords: "messi firmado", category_ids: "18000" });
