// Banco de pruebas del reconocedor de cartas.  Uso:  npm run probar-cartas
import { readFileSync } from "node:fs";
import { parseJugadores, reconocerCarta } from "../lib/cartas.ts";

const jugadores = parseJugadores(readFileSync("data/jugadores.txt", "utf8"));
const lineas = readFileSync("data/pruebas-cartas.tsv", "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
let bien = 0;
const fallos: string[] = [];
for (const l of lineas) {
  const [titulo, esperado] = l.split("\t");
  const r = reconocerCarta(titulo, jugadores);
  const obtenido = r.ok ? r.clave : `RECHAZO:${r.motivo}`;
  if (obtenido === esperado) bien++;
  else fallos.push(`  ✘ ${titulo}\n      esperado ${esperado}\n      obtenido ${obtenido}${!r.ok && r.detalle ? " (" + r.detalle + ")" : ""}`);
}
console.log(`Aciertos cartas: ${bien}/${lineas.length}`);
if (fallos.length) { console.log(fallos.join("\n")); process.exit(1); }
