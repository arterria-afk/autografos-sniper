import Link from "next/link";
import { notFound } from "next/navigation";
import { cartasDeJugador, estadisticas } from "@/lib/estadisticas";
import { jugadores } from "@/lib/personajes";
import { enlace } from "@/lib/enlaces";
import { eur } from "@/lib/ui";
import { Avatar, Kpi, n } from "@/components/Ficha";

export const dynamic = "force-dynamic";

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default async function CartasJugador({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = jugadores().find((x) => x.id === id);
  if (!j) notFound();
  const [{ cartas }, colecciones] = await Promise.all([estadisticas(), cartasDeJugador(id)]);
  const s = cartas[id];

  return (
    <div className="space-y-6">
      <Link href="/cartas" className="text-sm text-slate-400 hover:text-white">← Todas las cartas</Link>
      <div className="flex items-center gap-4">
        <Avatar src={s?.foto ?? null} nombre={j.nombre} grande />
        <div>
          <h1 className="text-2xl font-bold">{j.nombre}</h1>
          <p className="text-sm text-slate-400">{j.tipo === "leyenda" ? "Leyenda" : "Jugador actual"} · {colecciones.length} colecciones</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi etiqueta="Analizadas" v={n(s?.analizados ?? 0)} sub={`+${n(s?.nuevos7d ?? 0)} esta semana`} />
        <Kpi etiqueta="Cartas distintas" v={n(s?.distintas ?? 0)} color="text-cyan-300" />
        <Kpi etiqueta="A la venta" v={n(s?.activos ?? 0)} />
        <Kpi etiqueta="Ventas" v={n(s?.vendidos ?? 0)} sub={s?.medianaVenta ? `mediana ${eur(s.medianaVenta)}` : undefined} />
        <Kpi etiqueta="Chollos" v={n(s?.chollos ?? 0)} color="text-amber-300" />
      </div>

      {colecciones.length === 0 && <p className="text-slate-500">Aún no hay cartas guardadas de este jugador.</p>}
      {colecciones.map((c) => (
        <section key={c.coleccion} className="rounded-2xl border border-white/5 bg-white/[0.02]">
          <h2 className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="font-semibold capitalize">{c.coleccion === "?" ? "Colección sin identificar" : c.coleccion}</span>
            <span className="text-xs text-slate-500">{n(c.anuncios)} anuncios · {c.cartas.length} cartas</span>
          </h2>
          <ul className="divide-y divide-white/5">
            {c.cartas.slice(0, 25).map((g) => {
              const minVenta = g.activos.length ? Math.min(...g.activos.map((a) => a.price)) : null;
              const med = mediana(g.ventas.map((v) => v.price));
              const barata = g.activos.find((a) => a.price === minVenta);
              return (
                <li key={g.clave} className="flex items-center gap-3 px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {g.foto ? <img src={g.foto} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover ring-1 ring-white/10" /> : <div className="h-14 w-10 shrink-0 rounded bg-white/5" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.desc}</p>
                    <p className="text-xs text-slate-500">{g.anuncios} anuncios vistos · {g.activos.length} a la venta · {g.ventas.length} ventas</p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className={med ? "font-semibold text-emerald-300" : "text-slate-600"}>{med ? `vendida ~${eur(med)}` : "sin ventas"}</p>
                    {barata && <a href={enlace(barata.url)} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-white">desde {eur(minVenta)} ({barata.platform}) ↗</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
