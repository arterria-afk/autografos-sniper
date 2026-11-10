// Banco de pruebas del reconocedor.  Uso:  npm run probar
import { readFileSync } from "node:fs";
import { parsePersonajes, reconocer } from "../lib/recognize.ts";

const personajes = parsePersonajes(readFileSync("data/personajes.txt", "utf8"));
const lineas = readFileSync("data/pruebas-titulos.tsv", "utf8").split("\n").filter((l) => l && !l.startsWith("#"));

let bien = 0;
const fallos: string[] = [];
for (const l of lineas) {
  const [titulo, esperado] = l.split("\t");
  const r = reconocer(titulo, personajes);
  const obtenido = r.ok
    ? `${r.personaje.id}|${r.tipo}|${r.certificados[0] ?? (r.coaGenerico ? "COA" : "-")}`
    : `RECHAZO:${r.motivo}`;
  if (obtenido === esperado) bien++;
  else fallos.push(`  ✘ ${titulo}\n      esperado ${esperado}\n      obtenido ${obtenido}${!r.ok && r.detalle ? " (" + r.detalle + ")" : ""}`);
}
console.log(`Aciertos: ${bien}/${lineas.length}`);
if (fallos.length) { console.log(fallos.join("\n")); process.exit(1); }
