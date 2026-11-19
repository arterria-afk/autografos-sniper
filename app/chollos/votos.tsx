"use client";
import { useState } from "react";
import { votar } from "./actions";
import { MOTIVOS, MOTIVOS_DUDA, MOTIVOS_MAL_AUTO } from "@/lib/motivos";

const gris = "border-[#1f2a22] text-[#8fa394]";
const VERDE = "border-[#5cf08a] bg-[#5cf08a]/15 text-[#5cf08a]", AMBAR = "border-[#e8c35a] bg-[#e8c35a]/15 text-[#e8c35a]", ROJO = "border-[#f06b5c] bg-[#f06b5c]/15 text-[#f06b5c]";

// Autógrafos: ✅ parece bueno · 🤔 dudas (cuál) · ❌ mal (por qué) — se valora el anuncio, no el precio.
// Cartas: ✅ carta bien reconocida · ❌ no es esa carta · 👎 no me interesa.
export function Votos({ id, fb, motivo, carta = false }: { id: number; fb: string | null; motivo: string | null; carta?: boolean }) {
  const [abierto, setAbierto] = useState<"duda" | "mal" | null>(null);
  const boton = (v: string, texto: string, activo: boolean, cls: string, m?: string) => (
    <form action={votar}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="fb" value={v} />
      {m && <input type="hidden" name="motivo" value={m} />}
      <button className={`rounded border px-2 py-1 text-xs ${activo ? cls : gris}`}>{texto}</button>
    </form>
  );
  if (carta)
    return (
      <div className="flex flex-wrap items-center gap-2">
        {boton("bueno", "✅ Carta bien", fb === "bueno", VERDE)}
        {boton("mal", "❌ No es esa carta", fb === "mal" && motivo === "no_carta", ROJO, "no_carta")}
        {boton("mal", "👎 No me interesa", fb === "mal" && motivo === "no_interesa", AMBAR, "no_interesa")}
      </div>
    );
  const menu = (v: "duda" | "mal", opciones: Record<string, string>, cls: string, pregunta: string) => (
    <form action={votar} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="fb" value={v} />
      <select name="motivo" required defaultValue="" className={`rounded border bg-[#0a0d0b] px-2 py-1 text-xs ${cls}`}>
        <option value="" disabled>{pregunta}</option>
        {Object.entries(opciones).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
      <button className={`rounded border px-2 py-1 text-xs ${cls}`}>OK</button>
    </form>
  );
  const abrir = (v: "duda" | "mal", texto: string, cls: string) => (
    <button type="button" onClick={() => setAbierto(v)} className={`rounded border px-2 py-1 text-xs ${fb === v ? cls : gris}`}>
      {texto}{fb === v && motivo ? ` · ${MOTIVOS[motivo] ?? ""}` : ""}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {boton("bueno", "✅ Parece bueno", fb === "bueno", VERDE)}
      {abierto === "duda" ? menu("duda", MOTIVOS_DUDA, AMBAR, "¿Qué duda?") : abrir("duda", "🤔 Dudas", AMBAR)}
      {abierto === "mal" ? menu("mal", MOTIVOS_MAL_AUTO, ROJO, "¿Por qué?") : abrir("mal", "❌ Mal", ROJO)}
    </div>
  );
}

