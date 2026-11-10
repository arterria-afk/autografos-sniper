// Revisión de calidad: qué reconoce y qué rechaza el reconocedor con anuncios reales de Vinted.
import { readFileSync } from "node:fs";
import { buscar } from "./vinted.mjs";
import { parsePersonajes, reconocer } from "../lib/recognize.ts";

const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);
const personajes = parsePersonajes(readFileSync("data/personajes.txt", "utf8"));
const todos = new Map();
for (const p of personajes) for (const w of ["firmado", "autografo", "signed"]) {
  for (const it of await buscar(`${p.nombre} ${w}`)) todos.set(it.id, it);
  await new Promise((s) => setTimeout(s, 4000 + Math.random() * 2000));
}
const cert = [], sinCert = [], motivos = {}, conFirmaRechazados = [];
for (const it of todos.values()) {
  const r = reconocer(it.title, personajes);
  if (r.ok) (r.conCertificado ? cert : sinCert).push(`${it.price}€ [${r.personaje.id}|${r.tipo}|${r.certificados.join("+")}] ${it.title}`);
  else {
    motivos[r.motivo] = (motivos[r.motivo] ?? 0) + 1;
    if (r.motivo !== "sin_personaje" && r.motivo !== "sin_firma") conFirmaRechazados.push(`${r.motivo}${r.detalle ? "(" + r.detalle + ")" : ""}: ${it.title}`);
    else if (/firm|autog|sign/i.test(it.title)) conFirmaRechazados.push(`${r.motivo}: ${it.title}`);
  }
}
aviso("resumen", `únicos ${todos.size} · certificados ${cert.length} · sin certificado ${sinCert.length} · rechazos ${JSON.stringify(motivos)}`);
aviso("certificados", cert.join(" ||| "));
for (let i = 0; i < 3; i++) aviso("sin-cert-" + i, sinCert.slice(i * 30, i * 30 + 30).join(" ||| "));
for (let i = 0; i < 3; i++) aviso("rechazados-con-firma-" + i, conFirmaRechazados.slice(i * 30, i * 30 + 30).join(" ||| "));
