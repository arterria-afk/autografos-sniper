// Revisa si los anuncios guardados se han vendido (ventas reales = mejor referencia de precio).
import { bucle, pausa, web } from "./comun.mjs";
import { conFreno, estado } from "./vinted.mjs";

await bucle(async () => {
  const { cola } = await web("/api/vinted-sold?n=" + (process.env.N ?? 60));
  console.log(`Cola: ${cola.length} anuncios`);
  const resultados = [];
  for (const l of cola) {
    const e = await conFreno(() => estado(l.url));
    await pausa();
    if (e) resultados.push({ external_id: l.external_id, ...e });
    if (resultados.length >= 20) console.log(await web("/api/vinted-sold", { resultados: resultados.splice(0) }));
  }
  if (resultados.length) console.log(await web("/api/vinted-sold", { resultados }));
});
