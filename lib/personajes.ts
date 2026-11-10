import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePersonajes, type Personaje } from "./recognize";

let cache: Personaje[] | null = null;
export function personajes(): Personaje[] {
  if (!cache) cache = parsePersonajes(readFileSync(path.join(process.cwd(), "data/personajes.txt"), "utf8"));
  return cache;
}
