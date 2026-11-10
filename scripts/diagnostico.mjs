// Diagnóstico de Vinted: prueba el lector de resultados y mira la página de un anuncio.
import { buscar } from "./vinted.mjs";
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3800)}`);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const items = await buscar("messi firmado");
aviso("lector", `${items.length} anuncios. Primeros: ${JSON.stringify(items.slice(0, 4))}`);
const p2 = await buscar("messi firmado", 2);
aviso("pagina-2", `${p2.length} anuncios, repetidos con p1: ${p2.filter((x) => items.some((y) => y.id === x.id)).length}`);

// Página de un anuncio: ¿qué marcas de estado trae?
const it = items[0];
if (it) {
  const r = await fetch(it.url, { headers: { "user-agent": UA, accept: "text/html", "accept-language": "es-ES,es;q=0.9" } });
  const h = await r.text();
  const claves = ["can_buy", "is_closed", "is_reserved", "is_hidden", "is_sold", "item_closing_action", "status_id", "Vendido", "Reservado", "og:image", "og:title", "product:price:amount"];
  aviso("anuncio", `${r.status} largo=${h.length} ` + claves.map((k) => `${k}=${h.split(k).length - 1}`).join(" "));
  for (const k of ["can_buy", "is_closed", "is_reserved", "og:image", "product:price:amount"]) {
    const i = h.indexOf(k);
    if (i >= 0) aviso("ctx-" + k, h.slice(Math.max(0, i - 150), i + 250));
  }
}
// Un anuncio que ya no existe → ¿404?
const r404 = await fetch("https://www.vinted.es/items/1-no-existe", { headers: { "user-agent": UA, accept: "text/html" }, redirect: "manual" });
aviso("borrado", `${r404.status} location=${r404.headers.get("location")}`);
