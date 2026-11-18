// Detector de ventas en eBay: subastas recién terminadas (con pujas = venta real) y algunos de precio fijo.
// Cupo: ~90 consultas por ejecución (cada hora) → ~2.160/día, compartiendo el límite diario de eBay con la búsqueda.
import { web } from "./comun.mjs";

const salud = await web("/api/health");
if (salud.faltan?.includes("EBAY_CLIENT_ID")) { console.log("::notice title=ventas ebay::Sin claves de eBay"); process.exit(0); }

const total = { revisados: 0, ventas: 0, sin_venta: 0, siguen: 0, errores: 0 };
for (let i = 0; i < Number(process.env.TANDAS ?? 3); i++) {
  const r = await web("/api/ebay-sold?n=" + (process.env.N ?? 30), {});
  for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
  if ((r.revisados ?? 0) === 0) break;
}
console.log(`::notice title=ventas ebay::${JSON.stringify(total)}`);
