"use client";
import { useState } from "react";

// Sin Gixen Mirror no hay API: copiamos los datos y abrimos Gixen para pegarlos.
export function GixenBoton({ item, puja }: { item: string; puja: number }) {
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); } catch {} };
  if (paso === 0)
    return (
      <button type="button" className="rounded border border-[#5cf08a] px-2 py-1 text-xs text-[#5cf08a]"
        onClick={async () => { await copiar(item); window.open("https://www.gixen.com/main/index.php", "_blank", "noopener"); setPaso(1); }}>
        Preparar en Gixen
      </button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[#8fa394]">{paso === 1 ? "Nº copiado, pégalo en Gixen →" : "Puja copiada, pégala →"}</span>
      {paso === 1
        ? <button type="button" className="rounded border border-[#5cf08a] px-2 py-1 text-[#5cf08a]" onClick={async () => { await copiar(String(puja)); setPaso(2); }}>Copiar puja ({puja})</button>
        : <button type="button" className="rounded border border-[#1f2a22] px-2 py-1 text-[#8fa394]" onClick={() => setPaso(0)}>Repetir</button>}
    </span>
  );
}
