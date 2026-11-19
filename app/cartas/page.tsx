import { estadisticas, type StatsPersona } from "@/lib/estadisticas";
import { jugadores } from "@/lib/personajes";
import { eur } from "@/lib/ui";
import { Avatar, Cabecera, Kpi, n, Num, NumEnlace, Seccion, Tarjeta } from "@/components/Ficha";

export const dynamic = "force-dynamic";

function Ficha({ s, nombre, acento }: { s: StatsPersona; nombre: string; acento: string }) {
  return (
    <Tarjeta href={`/cartas/${s.id}`} acento={acento}>
      <div className="flex items-center gap-3">
        <Avatar src={s.foto} nombre={nombre} />
        <div className="min-w-0">
          <p className="truncate font-semibold group-hover:text-cyan-300">{nombre}</p>
          <p className="text-xs text-slate-500">{n(s.analizados)} analizadas · {n(s.distintas)} cartas distintas</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Num v={n(s.graduadas)} etiqueta="Graduadas" color="text-cyan-300" />
        <Num v={n(s.autos)} etiqueta="Autos" color="text-violet-300" />
        <Num v={n(s.vendidos)} etiqueta="Ventas" />
        <NumEnlace v={n(s.chollos)} etiqueta="Chollos" href={`/chollos?per=${encodeURIComponent(s.id)}&k=cartas&solo=chollos`} color={s.chollos ? "text-amber-300" : "text-white"} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{n(s.activos)} a la venta ahora</span>
        <span>{s.medianaVenta ? `venta mediana ${eur(s.medianaVenta)}` : "sin ventas aún"}</span>
      </div>
    </Tarjeta>
  );
}

export default async function Cartas() {
  const { cartas, calculado } = await estadisticas();
  const vacia = (id: string): StatsPersona => ({ id, analizados: 0, nuevos7d: 0, activos: 0, vendidos: 0, medianaVenta: null, chollos: 0, foto: null, plataformas: {}, certificados: 0, distintas: 0, graduadas: 0, autos: 0 });
  const lista = Object.values(cartas);
  const tot = (k: keyof StatsPersona) => lista.reduce((a, s) => a + (s[k] as number), 0);
  const grupos = [
    { titulo: "⚽ Actuales", tipo: "actual", acento: "from-cyan-500/10" },
    { titulo: "🏆 Leyendas", tipo: "leyenda", acento: "from-amber-500/10" },
  ];

  return (
    <div className="space-y-8">
      <Cabecera icono="🃏" titulo="Cartas" sub={`Numeradas, graduadas y autos con valor. Actualizado ${new Date(calculado).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi etiqueta="Analizadas" v={n(tot("analizados"))} sub={`+${n(tot("nuevos7d"))} esta semana`} />
        <Kpi etiqueta="Cartas distintas" v={n(tot("distintas"))} color="text-cyan-300" />
        <Kpi etiqueta="Ventas registradas" v={n(tot("vendidos"))} sub="precio de referencia" />
        <Kpi etiqueta="Chollos" v={n(tot("chollos"))} color="text-amber-300" href="/chollos?k=cartas&solo=chollos" />
      </div>
      {grupos.map((g) => {
        const js = jugadores().filter((j) => j.tipo === g.tipo).map((j) => ({ j, s: cartas[j.id] ?? vacia(j.id) })).sort((a, b) => b.s.analizados - a.s.analizados);
        return (
          <Seccion key={g.tipo} titulo={g.titulo} sub={`${js.length} jugadores`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {js.map(({ j, s }) => <Ficha key={j.id} s={s} nombre={j.nombre} acento={g.acento} />)}
            </div>
          </Seccion>
        );
      })}
    </div>
  );
}
