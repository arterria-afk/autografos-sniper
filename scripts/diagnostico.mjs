// Diagnóstico 7: ¿se ve el precio final de una subasta de eBay después de cerrar?
import { web, dormir } from "./comun.mjs";
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);

const { subastas = [], error } = await web("/api/ebay-subastas?q=" + encodeURIComponent("topps psa 10") + "&mercado=EBAY_US");
if (error) { aviso("error", error); process.exit(0); }
const pronto = subastas.filter((s) => s.fin && new Date(s.fin).getTime() - Date.now() < 12 * 60e3 && new Date(s.fin).getTime() > Date.now()).slice(0, 4);
aviso("subastas-a-punto", JSON.stringify(pronto.map((s) => ({ id: s.id, fin: s.fin, pujas: s.pujas, precio: s.precio, t: s.titulo.slice(0, 50) }))));
if (!pronto.length) { aviso("nada", "no hay subastas que terminen en <12 min; repetir"); process.exit(0); }

for (const s of pronto) aviso("antes " + s.id, JSON.stringify(await web(`/api/ebay-subastas?id=${s.id}&mercado=EBAY_US`)));
const ultimo = Math.max(...pronto.map((s) => new Date(s.fin).getTime()));
await dormir(Math.max(0, ultimo - Date.now()) + 3 * 60e3);
for (const s of pronto) aviso("despues " + s.id, JSON.stringify(await web(`/api/ebay-subastas?id=${s.id}&mercado=EBAY_US`)));
await dormir(20 * 60e3);
for (const s of pronto.slice(0, 2)) aviso("20min " + s.id, JSON.stringify(await web(`/api/ebay-subastas?id=${s.id}&mercado=EBAY_US`)));
