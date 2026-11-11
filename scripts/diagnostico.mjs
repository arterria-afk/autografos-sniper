// Diagnóstico 5: estado de migraciones + qué cartas reconoce en Vinted y Wallapop (sin guardar nada).
import { readFileSync } from "node:fs";
import * as vinted from "./vinted.mjs";
import * as wallapop from "./wallapop.mjs";
import { parseJugadores, reconocerCarta } from "../lib/cartas.ts";

const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);
const SITE = (process.env.SITE_URL ?? "").replace(/\/$/, "");
if (SITE) { const h = await (await fetch(SITE + "/api/health")).json(); aviso("migraciones", JSON.stringify(h.migraciones)); }

const jugadores = parseJugadores(readFileSync("data/jugadores.txt", "utf8"));
const ok = [], motivos = {};
const vistos = new Set();
for (const j of jugadores.slice(0, 6)) {
  for (const w of ["topps", "panini", "psa"]) {
    const lotes = [
      await vinted.buscar(`${j.nombre} ${w}`, 1, 25).catch(() => []),
      await wallapop.buscar(`${j.nombre} ${w}`, 1, 25).catch(() => []),
    ];
    for (const [i, items] of lotes.entries()) for (const it of items ?? []) {
      if (vistos.has(it.url)) continue; vistos.add(it.url);
      const c = reconocerCarta(it.title, jugadores);
      if (c.ok) ok.push(`${it.price}€ ${i ? "W" : "V"} [${c.descripcion}] ${it.title}`);
      else motivos[c.motivo] = (motivos[c.motivo] ?? 0) + 1;
    }
    await new Promise((s) => setTimeout(s, 4000));
  }
}
aviso("resumen", `anuncios ${vistos.size} · cartas con valor ${ok.length} · rechazos ${JSON.stringify(motivos)}`);
for (let i = 0; i < 5; i++) if (ok[i * 22]) aviso("cartas-" + i, ok.slice(i * 22, i * 22 + 22).join(" ||| "));
