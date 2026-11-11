// Lee los anuncios más nuevos de Vinted (autógrafos y cartas) y los manda a la web.
// MODE=live (alerta) | sweep (solo guarda, varias páginas).
import { bucle, busquedas, pausa, web } from "./comun.mjs";
import { buscar, conFreno } from "./vinted.mjs";

const MODE = process.env.MODE ?? "live";
const PAGINAS = MODE === "sweep" ? 11 : 1;

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, cartas: 0, nuevos: 0, alertas: 0 };
  for (const b of busquedas()) {
    for (let page = 1; page <= PAGINAS; page++) {
      const items = await conFreno(() => buscar(b.texto, page, b.min));
      await pausa();
      if (!items?.length) break;
      const r = await web("/api/vinted", { items, mode: MODE, platform: "vinted" });
      for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
      console.log(`"${b.texto}" p${page}: ${items.length} anuncios, ${r.reconocidos} reconocidos (${r.cartas} cartas), ${r.nuevos} nuevos`);
      if (items.length < 96) break;
    }
  }
  console.log("Pasada terminada:", total);
  console.log(`::notice title=pasada ${MODE}::${JSON.stringify(total)}`);
});
