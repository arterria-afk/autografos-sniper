import { eur } from "./ui";

type Punto = { t: number; precio: number; titulo: string };

// Ventas en el tiempo: una sola serie (puntos) + línea discontinua de la mediana. Hover = <title> nativo.
export function GraficaVentas({ puntos, mediana }: { puntos: Punto[]; mediana: number | null }) {
  if (puntos.length < 2) return <p className="px-4 py-6 text-center text-sm text-[#5f7364]">Hacen falta al menos 2 ventas para dibujar la gráfica.</p>;
  const W = 640, H = 220, P = { l: 52, r: 12, t: 12, b: 26 };
  const ts = puntos.map((p) => p.t), ps = puntos.map((p) => p.precio);
  const t0 = Math.min(...ts), t1 = Math.max(...ts) || t0 + 1;
  const max = Math.max(...ps) * 1.1, min = 0;
  const x = (t: number) => P.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - ((v - min) / (max - min)) * (H - P.t - P.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const mes = (t: number) => new Date(t).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Precio de las ventas en el tiempo">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#1f2a22" strokeWidth={1} />
          <text x={P.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#5f7364">{Math.round(v)}€</text>
        </g>
      ))}
      <text x={P.l} y={H - 6} fontSize={11} fill="#5f7364">{mes(t0)}</text>
      <text x={W - P.r} y={H - 6} fontSize={11} fill="#5f7364" textAnchor="end">{mes(t1)}</text>
      {mediana != null && (
        <g>
          <line x1={P.l} x2={W - P.r} y1={y(mediana)} y2={y(mediana)} stroke="#8fa394" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - P.r} y={y(mediana) - 5} textAnchor="end" fontSize={11} fill="#8fa394">mediana {eur(mediana)}</text>
        </g>
      )}
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.t)} cy={y(p.precio)} r={5} fill="#5cf08a" stroke="#0f1411" strokeWidth={2} />
          {/* zona de hover más grande que el punto */}
          <circle cx={x(p.t)} cy={y(p.precio)} r={12} fill="transparent">
            <title>{`${eur(p.precio)} · ${new Date(p.t).toLocaleDateString("es-ES")}\n${p.titulo}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
