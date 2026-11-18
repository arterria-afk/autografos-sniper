// Lee los anuncios más nuevos de Vinted (autógrafos y cartas) y los manda a la web.
// Después lee la DESCRIPCIÓN de cada anuncio nuevo (la búsqueda no la trae) y la web decide si alerta.
// MODE=live (alerta) | sweep (solo guarda, varias páginas).
import { bucle, busquedas, pausa, web } from "./comun.mjs";
import { buscar, conFreno, descripcion } from "./vinted.mjs";

const MODE = process.env.MODE ?? "live";
const PAGINAS = MODE === "sweep" ? 11 : 1;
const MAX_DESC = Number(process.env.MAX_DESC ?? 40); // descripciones por pasada (cada una es una visita a Vinted)

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, cartas: 0, nuevos: 0 };
  const pendientes = [];
  for (const b of busquedas()) {
    for (let page = 1; page <= PAGINAS; page++) {
      const items = await conFreno(() => buscar(b.texto, page, b.min));
      await pausa();
      if (!items?.length) break;
      const r = await web("/api/vinted", { items, mode: MODE, platform: "vinted" });
      for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
      pendientes.push(...(r.pendientes ?? []));
      if (items.length < 96) break;
    }
  }

  // Descripciones de los nuevos → la web re-evalúa (certificado, quién firma, copias) y alerta si procede.
  const desc = { leidas: 0, sin_leer: 0, descartados: 0, certificados: 0, candidatos: 0 };
  const lote = [];
  for (const [i, p] of pendientes.entries()) {
    let d = null;
    if (i < MAX_DESC) { d = await conFreno(() => descripcion(p.url)); await pausa(); }
    if (d) desc.leidas++; else desc.sin_leer++;
    lote.push({ external_id: p.external_id, descripcion: d ?? "" });
    if (lote.length >= 15 || i === pendientes.length - 1) {
      const r = await web("/api/descripcion", { items: lote.splice(0) });
      for (const k of ["descartados", "certificados", "candidatos"]) desc[k] += r[k] ?? 0;
    }
  }
  console.log("Pasada terminada:", total, desc);
  console.log(`::notice title=pasada ${MODE}::${JSON.stringify({ ...total, descripciones: desc })}`);
});
