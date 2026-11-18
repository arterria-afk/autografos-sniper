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

// Nombre legible de un personaje, jugador o multifirma ("al-pacino+robert-de-niro" → "Al Pacino + Robert De Niro").
export function nombreDe(id: string | null | undefined): string {
  if (!id) return "—";
  const todos = [...personajes(), ...jugadores()];
  return id.split("+").map((x) => todos.find((p) => p.id === x)?.nombre ?? x).join(" + ");
}
