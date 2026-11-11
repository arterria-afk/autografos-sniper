import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePersonajes, type Personaje } from "./recognize";

let cache: Personaje[] | null = null;
export function personajes(): Personaje[] {
  if (!cache) cache = parsePersonajes(readFileSync(path.join(process.cwd(), "data/personajes.txt"), "utf8"));
  return cache;
}

import { parseJugadores, type Jugador } from "./cartas";
let cacheJ: Jugador[] | null = null;
export function jugadores(): Jugador[] {
  if (!cacheJ) cacheJ = parseJugadores(readFileSync(path.join(process.cwd(), "data/jugadores.txt"), "utf8"));
  return cacheJ;
}
