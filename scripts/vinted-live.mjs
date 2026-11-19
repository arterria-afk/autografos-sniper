// Lee los anuncios más nuevos de Vinted (autógrafos y cartas) y los manda a la web.
// Después lee la DESCRIPCIÓN de cada anuncio nuevo (la búsqueda no la trae) y la web decide si alerta.
// MODE=live (alerta) | sweep (solo guarda, varias páginas).
import { bucle, busquedas, pausa, web } from "./comun.mjs";
import { buscar, conFreno, descripcion, PAIS } from "./vinted.mjs";

const MODE = process.env.MODE ?? "live";
const PAGINAS = MODE === "sweep" ? 11 : 1;
const MAX_DESC = Number(process.env.MAX_DESC ?? 40); // descripciones por pasada (cada una es una visita a Vinted)
// Palabras de autógrafo en el idioma de cada Vinted; búsquedas amplias de ese país ("vinted", "vinted-fr"…).
const PALABRAS = { FR: ["dédicacé", "autographe", "signé"], IT: ["autografato", "autografo", "firmato"], DE: ["signiert", "autogramm"] }[PAIS];
const DONDE = PAIS === "ES" ? "vinted" : `vinted-${PAIS.toLowerCase()}`;

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, cartas: 0, nuevos: 0 };
  const pendientes = [];
  // Se envían a la web en grupos (≈300 anuncios por llamada) para no gastar el cupo de Vercel.
  let grupo = [];
  const enviar = async () => {
    if (!grupo.length) return;
    const vistos = new Set(), items = grupo.filter((x) => !vistos.has(x.id) && vistos.add(x.id));
    grupo = [];
    const r = await web("/api/vinted", { items, mode: MODE, platform: "vinted" });
    for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
    pendientes.push(...(r.pendientes ?? []));
  };
  for (const b of busquedas(PALABRAS, DONDE)) {
    for (let page = 1; page <= PAGINAS; page++) {
      const items = await conFreno(() => buscar(b.texto, page, b.min));
      await pausa();
      if (!items?.length) break;
      grupo.push(...items);
      if (grupo.length >= 300) await enviar();
      if (items.length < 96) break;
    }
  }
  await enviar();

  // Descripciones de los nuevos → la web re-evalúa (certificado, quién firma, copias) y alerta si procede.
  const desc = { leidas: 0, sin_leer: 0, descartados: 0, certificados: 0, candidatos: 0 };
  const lote = [];
  for (const [i, p] of pendientes.entries()) {
    let d = null;
    if (i < MAX_DESC) { d = await conFreno(() => descripcion(p.url)); await pausa(); }
    if (d) desc.leidas++; else desc.sin_leer++;
    // Más allá de MAX_DESC no se lee la descripción → se guarda la evaluación pero NO se alerta (evita avalanchas).
    lote.push({ external_id: p.external_id, descripcion: d ?? "", interes: p.interes, ...(i >= MAX_DESC ? { sinAlerta: true } : {}) });
    if (lote.length >= 15 || i === pendientes.length - 1) {
      const r = await web("/api/descripcion", { items: lote.splice(0) });
      for (const k of ["descartados", "certificados", "candidatos"]) desc[k] += r[k] ?? 0;
    }
  }
  console.log("Pasada terminada:", total, desc);
  console.log(`::notice title=pasada ${MODE} ${PAIS}::${JSON.stringify({ ...total, descripciones: desc })}`);
});
