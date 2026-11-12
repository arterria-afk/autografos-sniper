// Busca en eBay (API oficial) autógrafos y cartas en varios mercados, vía la web (las claves están en Vercel).
// Presupuesto: ~5.000 llamadas/día → por defecto cada 2 horas.
import { bucle, busquedas, web } from "./comun.mjs";

const MERCADOS = (process.env.EBAY_MERCADOS ?? "EBAY_ES,EBAY_DE,EBAY_GB,EBAY_US").split(",");

// Sin claves de eBay en Vercel todavía → no hacer nada (y no marcar error).
const salud = await web("/api/health");
if (salud.faltan?.includes("EBAY_CLIENT_ID") || salud.faltan?.includes("EBAY_CLIENT_SECRET")) {
  console.log("::notice title=ebay::Faltan EBAY_CLIENT_ID / EBAY_CLIENT_SECRET en Vercel. Pasada saltada.");
  process.exit(0);
}

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, cartas: 0, nuevos: 0, subastas: 0 };
  let errores = 0, ultimoError = "";
  for (const mercado of MERCADOS) {
    for (const b of busquedas()) {
      try {
        const r = await web("/api/ebay", { q: b.texto, mercado, min: b.min });
        for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
      } catch (e) {
        errores++; ultimoError = e.message;
        if (/503|401|token/.test(e.message)) { console.error("❌ " + e.message); throw e; } // sin claves o claves malas: parar
      }
      await new Promise((s) => setTimeout(s, 300));
    }
  }
  console.log("Pasada terminada:", total, errores ? `errores ${errores}: ${ultimoError}` : "");
  console.log(`::notice title=pasada ebay::${JSON.stringify({ ...total, errores, ultimoError: ultimoError.slice(0, 200) })}`);
});
