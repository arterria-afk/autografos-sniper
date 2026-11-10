// Diagnóstico de Vinted: prueba varias URLs y guarda estado, cabeceras y un trozo del cuerpo en diag/.
import { mkdirSync, writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const BASE = "https://www.vinted.es";
const q = encodeURIComponent("messi firmado");
mkdirSync("diag", { recursive: true });

let cookies = "";
async function probar(nombre, url, accept) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept, "accept-language": "es-ES,es;q=0.9", ...(cookies ? { cookie: cookies } : {}) }, redirect: "manual" });
  const set = r.headers.getSetCookie?.() ?? [];
  if (set.length) cookies = [...new Set([...cookies.split("; ").filter(Boolean), ...set.map((c) => c.split(";")[0])])].join("; ");
  const body = await r.text();
  const info = { url, status: r.status, location: r.headers.get("location"), tipo: r.headers.get("content-type"), cookiesRecibidas: set.map((c) => c.split("=")[0]), largo: body.length };
  console.log(nombre, JSON.stringify(info));
  // Aviso visible por la API de GitHub (annotations): resumen + pistas del contenido.
  const pistas = {
    items: (body.match(/\/items\/\d+/g) ?? []).length,
    testid: (body.match(/data-testid="[^"]*product-item[^"]*"/g) ?? []).slice(0, 2),
    nextData: body.includes("__NEXT_DATA__"), nextF: body.includes("self.__next_f"),
    catalogItems: body.includes("catalogItems") || body.includes("catalog_items"),
    titulo: body.match(/<title>([^<]{0,80})/)?.[1] ?? null,
    inicio: body.slice(0, 160).replace(/\s+/g, " "),
  };
  console.log(`::notice title=${nombre}::${JSON.stringify({ ...info, ...pistas }).replace(/[\r\n%]/g, " ")}`);
  writeFileSync(`diag/${nombre}.json`, JSON.stringify(info, null, 2));
  writeFileSync(`diag/${nombre}.txt`, body.slice(0, 400000));
  await new Promise((s) => setTimeout(s, 4000));
}

await probar("01-portada", BASE + "/", "text/html");
await probar("02-api-catalog-items", `${BASE}/api/v2/catalog/items?search_text=${q}&order=newest_first&per_page=96&page=1`, "application/json");
await probar("03-pagina-catalog", `${BASE}/catalog?search_text=${q}&order=newest_first`, "text/html");
await probar("04-api-items-sin-v2", `${BASE}/api/catalog/items?search_text=${q}&order=newest_first&per_page=96`, "application/json");
await probar("05-web-api-core", `${BASE}/web/api/core/catalog/items?search_text=${q}&order=newest_first&per_page=96`, "application/json");
