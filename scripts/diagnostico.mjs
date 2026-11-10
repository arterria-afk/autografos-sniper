// Diagnóstico de Vinted: muestra trozos de la página de resultados (vía avisos de GitHub).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const aviso = (t, s) => console.log(`::notice title=${t}::${s.replace(/[\r\n%]/g, " ").slice(0, 3800)}`);

const r = await fetch("https://www.vinted.es/catalog?search_text=" + encodeURIComponent("messi firmado") + "&order=newest_first", {
  headers: { "user-agent": UA, accept: "text/html", "accept-language": "es-ES,es;q=0.9" },
});
const html = await r.text();
aviso("estado", `${r.status} largo=${html.length}`);

// 1) bloque HTML del primer anuncio
const i = html.indexOf('data-testid="product-item-id-');
aviso("html-1", html.slice(Math.max(0, i - 300), i + 3500));
aviso("html-2", html.slice(i + 3500, i + 7300));

// 2) el mismo anuncio dentro de los datos de Next (self.__next_f)
const id = html.slice(i).match(/product-item-id-(\d+)/)?.[1];
const pos = [...html.matchAll(new RegExp(String(id), "g"))].map((m) => m.index);
aviso("posiciones-id", `${id} → ${pos.length} veces: ${pos.slice(0, 20).join(",")}`);
const j = pos.find((p) => html.slice(p - 40, p).includes('id'));
if (j) { aviso("next-1", html.slice(j - 200, j + 3600)); aviso("next-2", html.slice(j + 3600, j + 7400)); }
