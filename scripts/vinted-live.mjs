// Lee los anuncios más nuevos de Vinted y los manda a la web.  MODE=live (alerta) | sweep (solo guarda, varias páginas).
import { bucle, pausa, personajes, web } from "./comun.mjs";
import { buscar, conFreno } from "./vinted.mjs";

const MODE = process.env.MODE ?? "live";
const PAGINAS = MODE === "sweep" ? 11 : 1;
const PALABRAS = (process.env.PALABRAS ?? "firmado,autografo,signed").split(",");

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, nuevos: 0, alertas: 0 };
  for (const p of personajes()) {
    for (const palabra of PALABRAS) {
      for (let page = 1; page <= PAGINAS; page++) {
        const items = await conFreno(() => buscar(`${p.nombre} ${palabra}`, page));
        await pausa();
        if (!items?.length) break;
        const r = await web("/api/vinted", { items, mode: MODE, platform: "vinted" });
        for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
        console.log(`${p.nombre} "${palabra}" p${page}: ${items.length} anuncios, ${r.reconocidos} reconocidos, ${r.nuevos} nuevos, ${r.alertas} alertas`);
        if (items.length < 96) break;
      }
    }
  }
  console.log("Pasada terminada:", total);
  console.log(`::notice title=pasada ${MODE}::${JSON.stringify(total)}`);
});
