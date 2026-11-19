import Link from "next/link";

// Avatar: foto del anuncio o iniciales con color estable por nombre.
export function Avatar({ src, nombre, grande = false }: { src: string | null; nombre: string; grande?: boolean }) {
  const t = grande ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg";
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={nombre} loading="lazy" className={`${t} shrink-0 rounded-xl object-cover ring-1 ring-white/10`} />;
  const ini = nombre.split(/[\s+]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const h = [...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <div className={`${t} grid shrink-0 place-items-center rounded-xl font-semibold text-white`} style={{ background: `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 40) % 360} 70% 30%))` }}>{ini}</div>;
}

export function Num({ v, etiqueta, color = "text-white" }: { v: string | number; etiqueta: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{v}</p>
      <p className="truncate text-[11px] uppercase tracking-wide text-slate-500">{etiqueta}</p>
    </div>
  );
}

export function Tarjeta({ href, children, acento = "from-emerald-500/10" }: { href: string; children: React.ReactNode; acento?: string }) {
  return (
    <Link href={href} className={`group block rounded-2xl border border-white/5 bg-gradient-to-br ${acento} to-transparent p-4 transition hover:border-white/15 hover:bg-white/[0.03]`}>
      {children}
    </Link>
  );
}

export function Seccion({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {sub && <span className="text-sm text-slate-500">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

export function Cabecera({ icono, titulo, sub, children }: { icono: string; titulo: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span>{icono}</span>{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ v, etiqueta, sub, color = "text-white" }: { v: string | number; etiqueta: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{v}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export const n = (x: number) => x.toLocaleString("es-ES");
