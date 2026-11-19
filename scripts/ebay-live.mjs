// Busca en eBay (API oficial) autógrafos y cartas en varios mercados, vía la web (las claves están en Vercel).
// Presupuesto: ~5.000 llamadas/día compartidas con el detector de ventas → búsqueda cada 3 horas.
import { bucle, busquedas, dormir, web } from "./comun.mjs";

const MERCADOS = (process.env.EBAY_MERCADOS ?? "EBAY_ES,EBAY_DE,EBAY_GB,EBAY_US").split(",");
const ORDEN = process.env.ORDEN ?? "nuevos"; // nuevos | terminan
// Palabras de autógrafo en el idioma de cada eBay (ahorra cupo: buscar "firmado" en eBay EE. UU. no sirve).
const PALABRAS = {
  EBAY_ES: ["firmado", "autografo", "signed"],
  EBAY_DE: ["signiert", "signed"],
  EBAY_GB: ["signed", "autograph"],
  EBAY_US: ["signed", "autograph"],
};

// Sin claves de eBay en Vercel todavía → no hacer nada (y no marcar error).
const salud = await web("/api/health");
if (salud.faltan?.includes("EBAY_CLIENT_ID") || salud.faltan?.includes("EBAY_CLIENT_SECRET")) {
  console.log("::notice title=ebay::Faltan EBAY_CLIENT_ID / EBAY_CLIENT_SECRET en Vercel. Pasada saltada.");
  process.exit(0);
}

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, cartas: 0, nuevos: 0, subastas: 0 };
  const errores = {};
  let ok = 0, seguidos = 0;
  for (const mercado of MERCADOS) {
    for (const b of busquedas(PALABRAS[mercado], ORDEN === "nuevos" ? mercado : undefined)) {
      let r = null;
      for (let intento = 0; intento < 2 && !r; intento++) {
        try { r = await web("/api/ebay", { q: b.texto, mercado, min: b.min, orden: ORDEN }); }
        catch (e) {
          const tipo = (e.message.match(/eBay[^"]{0,80}/)?.[0] ?? e.message).slice(0, 90);
          errores[tipo] = (errores[tipo] ?? 0) + 1;
          await dormir(2000);
        }
      }
      if (r) { ok++; seguidos = 0; for (const k of Object.keys(total)) total[k] += r[k] ?? 0; }
      else if (++seguidos >= 15) { console.error("❌ 15 búsquedas seguidas con error: paro esta pasada"); break; }
      await dormir(300);
    }
    if (seguidos >= 15) break;
  }
  console.log("Pasada terminada:", total, errores);
  console.log(`::notice title=pasada ebay ${ORDEN}::${JSON.stringify({ ...total, busquedas_ok: ok, errores })}`.slice(0, 3900));
  if (!ok) throw new Error("ninguna búsqueda de eBay funcionó");
});
