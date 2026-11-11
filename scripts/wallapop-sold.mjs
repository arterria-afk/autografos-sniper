// Revisa si los anuncios de Wallapop guardados se han vendido.
// Prudencia: solo cuenta como VENTA si Wallapop lo marca claramente como vendido; si desaparece (404) es "borrado".
import { bucle, pausa, web } from "./comun.mjs";
import { estado } from "./wallapop.mjs";

let desconocidos = 0;
await bucle(async () => {
  const { cola } = await web("/api/vinted-sold?platform=wallapop&n=" + (process.env.N ?? 60));
  console.log(`Cola: ${cola.length} anuncios`);
  const resultados = [];
  for (const l of cola) {
    const e = await estado(l.external_id.replace(/^wallapop:/, ""));
    await pausa();
    if (!e) continue;
    if (e.nota && desconocidos++ < 3) console.log(`::notice title=wallapop estado raro::${e.nota}`);
    resultados.push({ external_id: l.external_id, estado: e.estado });
    if (resultados.length >= 20) console.log(await web("/api/vinted-sold", { resultados: resultados.splice(0) }));
  }
  if (resultados.length) console.log(await web("/api/vinted-sold", { resultados }));
  console.log(`::notice title=ventas wallapop::revisados ${cola.length}`);
});
