import { envStatus } from "@/lib/env";

const HOJA = [
  ["Web, base de datos y bot de Telegram", "hecho"],
  ["Reconocedor de autógrafos (+ Topps, Leaf, Futera)", "hecho"],
  ["Vinted en directo + detector de ventas", "hecho"],
  ["Wallapop en directo", "probando"],
  ["Panel, Chollos con 3 botones, Mi negocio", "hecho"],
  ["Precio de referencia (mis ventas → Vinted → eBay)", "hecho"],
  ["Snipes con Gixen (manual) → inventario", "hecho"],
  ["eBay", "pendiente: claves eBay"],
  ["Etsy", "pendiente: clave Etsy"],
  ["Catawiki como referencia de venta", "aparcado: su API no da precios finales"],
  ["Todocoleccion", "descartado: protección anti-robots"],
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
