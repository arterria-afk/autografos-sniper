// Revisión de calidad en Wallapop: qué marca como certificado y qué rechaza.
import { readFileSync } from "node:fs";
import { buscar } from "./wallapop.mjs";
import { parsePersonajes, reconocer } from "../lib/recognize.ts";

const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);
const personajes = parsePersonajes(readFileSync("data/personajes.txt", "utf8"));
const util = (d) => (!d || /no leer|tags?:|keywords|etiquetas|palabras clave/i.test(d) ? "" : d.slice(0, 1500));
const todos = new Map();
for (const p of personajes) for (const w of ["firmado", "autografo", "signed"]) {
  for (const it of await buscar(`${p.nombre} ${w}`)) todos.set(it.id, it);
  await new Promise((s) => setTimeout(s, 3000));
}
const cert = [], porDesc = [];
for (const it of todos.values()) {
  const r = reconocer(it.title, personajes, util(it.description));
  const soloTitulo = reconocer(it.title, personajes);
  if (r.ok && r.conCertificado) {
    cert.push(`${it.price}€ [${r.personaje.id}|${r.tipo}|${r.certificados.join("+")}] ${it.title}`);
    if (soloTitulo.ok && !soloTitulo.conCertificado) {
      const d = util(it.description);
      const k = d.search(/psa|beckett|jsa|upper deck|fanatics|panini|topps|leaf|futera|\bbas\b/i);
      porDesc.push(`${it.title} ⇒ «${d.slice(Math.max(0, k - 80), k + 80)}»`);
    }
  }
}
aviso("resumen", `únicos ${todos.size} · certificados ${cert.length} (de ellos ${porDesc.length} solo por la descripción)`);
for (let i = 0; i < 3; i++) aviso("cert-" + i, cert.slice(i * 25, i * 25 + 25).join(" ||| "));
for (let i = 0; i < 2; i++) aviso("por-descripcion-" + i, porDesc.slice(i * 12, i * 12 + 12).join(" ||| "));
