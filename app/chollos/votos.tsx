"use client";
import { useState } from "react";
import { votar } from "./actions";

const MOTIVOS = [["no_firma", "No es firma real"], ["no_personaje", "No es ese personaje"], ["precio", "Precio mal calculado"], ["otro", "Otro"]];
const ETQ: Record<string, string> = { bueno: "✅ Bueno", duda: "🤔 Dudas", mal: "❌ Equivocado" };

export function Votos({ id, fb, motivo }: { id: number; fb: string | null; motivo: string | null }) {
  const [pidiendo, setPidiendo] = useState(false);
  const btn = (v: string, cls: string) => (
    <form action={votar}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="fb" value={v} />
      <button className={`rounded border px-2 py-1 text-xs ${fb === v ? cls : "border-[#1f2a22] text-[#8fa394]"}`}>{ETQ[v]}</button>
    </form>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {btn("bueno", "border-[#5cf08a] bg-[#5cf08a]/15 text-[#5cf08a]")}
      {btn("duda", "border-[#e8c35a] bg-[#e8c35a]/15 text-[#e8c35a]")}
      {pidiendo ? (
        <form action={votar} className="flex items-center gap-1">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="fb" value="mal" />
          <select name="motivo" required defaultValue="" className="rounded border border-[#f06b5c] bg-[#0a0d0b] px-2 py-1 text-xs">
            <option value="" disabled>¿Por qué?</option>
            {MOTIVOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <button className="rounded border border-[#f06b5c] px-2 py-1 text-xs text-[#f06b5c]">OK</button>
        </form>
      ) : (
        <button type="button" onClick={() => setPidiendo(true)}
          className={`rounded border px-2 py-1 text-xs ${fb === "mal" ? "border-[#f06b5c] bg-[#f06b5c]/15 text-[#f06b5c]" : "border-[#1f2a22] text-[#8fa394]"}`}>
          {ETQ.mal}{fb === "mal" && motivo ? ` · ${MOTIVOS.find((m) => m[0] === motivo)?.[1] ?? ""}` : ""}
        </button>
      )}
    </div>
  );
}
