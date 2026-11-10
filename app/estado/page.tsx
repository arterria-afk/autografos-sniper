import { envStatus } from "@/lib/env";

const HOJA = [
  ["Esqueleto web + comprobación de claves", "hecho"],
  ["Base de datos (Supabase) + bot de Telegram", "hecho"],
  ["Catálogo de personajes + reconocedor", "hecho"],
  ["Alertas de eBay (todos los mercados)", "pendiente: claves eBay"],
  ["Vinted en directo (cada 15 min)", "probando"],
  ["Detector de ventas reales en Vinted", "probando"],
  ["Precio de referencia (ventas + eBay)", "hecho"],
  ["Juez de chollos + votos en Telegram", "hecho"],
  ["Página «Valorar»", "hecho"],
  ["Página por personaje con gráfica", "hecho"],
  ["Snipes con Gixen (modo manual)", "hecho"],
];

export const dynamic = "force-dynamic";

export default function Estado() {
  const vars = envStatus();
  const faltan = vars.filter((v) => !v.ok && !v.opcional).length;
  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Estado de las claves</h1>
      <p className="text-sm text-[#8fa394]">
        {faltan === 0
          ? "Todo configurado."
          : `Faltan ${faltan} claves. Se añaden en Vercel → Settings → Environment Variables y después hay que hacer «Redeploy».`}
      </p>
      <ul className="rounded border border-[#1f2a22] bg-[#0f1411] divide-y divide-[#1f2a22] text-sm">
        {vars.map((v) => (
          <li key={v.name} className="px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span>
              <span className={v.ok ? "text-[#5cf08a]" : v.opcional ? "text-[#5f7364]" : "text-[#f06b5c]"}>{v.ok ? "✔" : v.opcional ? "–" : "✘"}</span>{" "}
              <code className="break-all">{v.name}</code>
            </span>
            <span className="text-[#5f7364] text-xs">{v.desc} · fase {v.fase}</span>
          </li>
        ))}
      </ul>
      <h2 className="pt-4 text-[#5cf08a]">Hoja de ruta</h2>
      <ul className="rounded border border-[#1f2a22] bg-[#0f1411] divide-y divide-[#1f2a22] text-sm">
        {HOJA.map(([t, e], i) => (
          <li key={t} className="flex justify-between gap-3 px-4 py-2">
            <span><span className="text-[#5f7364]">{String(i + 1).padStart(2, "0")}</span> {t}</span>
            <span className={e === "hecho" ? "text-[#5cf08a]" : e === "pendiente" ? "text-[#5f7364]" : "text-[#e8c35a]"}>[{e}]</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
