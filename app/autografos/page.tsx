import { estadisticas, type StatsPersona } from "@/lib/estadisticas";
import { nombreDe, personajes } from "@/lib/personajes";
import { eur } from "@/lib/ui";
import { Avatar, Cabecera, Kpi, n, Num, Seccion, Tarjeta } from "@/components/Ficha";

export const dynamic = "force-dynamic";

const CATEGORIAS: Record<string, { titulo: string; icono: string; acento: string }> = {
  futbol: { titulo: "Fútbol", icono: "⚽", acento: "from-emerald-500/10" },
  baloncesto: { titulo: "Baloncesto", icono: "🏀", acento: "from-orange-500/10" },
  musica: { titulo: "Música", icono: "🎤", acento: "from-fuchsia-500/10" },
  cine: { titulo: "Cine", icono: "🎬", acento: "from-sky-500/10" },
};

function Ficha({ s, nombre, acento }: { s: StatsPersona; nombre: string; acento: string }) {
  return (
    <Tarjeta href={`/personaje/${encodeURIComponent(s.id)}`} acento={acento}>
      <div className="flex items-center gap-3">
        <Avatar src={s.foto} nombre={nombre} />
        <div className="min-w-0">
          <p className="truncate font-semibold group-hover:text-emerald-300">{nombre}</p>
          <p className="text-xs text-slate-500">{n(s.analizados)} analizados · +{n(s.nuevos7d)} esta semana</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Num v={n(s.certificados)} etiqueta="Certific." color="text-emerald-300" />
        <Num v={n(s.vendidos)} etiqueta="Ventas" />
        <Num v={s.medianaVenta ? eur(s.medianaVenta) : "—"} etiqueta="Mediana" />
        <Num v={n(s.chollos)} etiqueta="Chollos" color={s.chollos ? "text-amber-300" : "text-white"} />
      </div>
      {s.analizados > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5" title="Certificados sobre analizados">
          <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max(3, Math.round((s.certificados / s.analizados) * 100))}%` }} />
        </div>
      )}
    </Tarjeta>
  );
}

export default async function Autografos() {
  const { auto, calculado } = await estadisticas();
  const vacia = (id: string): StatsPersona => ({ id, analizados: 0, nuevos7d: 0, activos: 0, vendidos: 0, medianaVenta: null, chollos: 0, foto: null, plataformas: {}, certificados: 0, distintas: 0, graduadas: 0, autos: 0 });
  const lista = Object.values(auto);
  const tot = (k: keyof StatsPersona) => lista.reduce((a, s) => a + (s[k] as number), 0);
  const multifirma = lista.filter((s) => s.id.includes("+")).sort((a, b) => b.analizados - a.analizados);

  return (
    <div className="space-y-8">
      <Cabecera icono="✍️" titulo="Autógrafos" sub={`Memorabilia firmada (camisetas, fotos, balones, pósters…). Actualizado ${new Date(calculado).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi etiqueta="Analizados" v={n(tot("analizados"))} sub={`+${n(tot("nuevos7d"))} esta semana`} />
        <Kpi etiqueta="Con certificado" v={n(tot("certificados"))} color="text-emerald-300" />
        <Kpi etiqueta="Ventas registradas" v={n(tot("vendidos"))} sub="precio de referencia" />
        <Kpi etiqueta="Chollos" v={n(tot("chollos"))} color="text-amber-300" />
      </div>

      {Object.entries(CATEGORIAS).map(([cat, c]) => {
        const ps = personajes().filter((p) => p.categoria === cat);
        if (!ps.length) return null;
        const filas = ps.map((p) => ({ p, s: auto[p.id] ?? vacia(p.id) })).sort((a, b) => b.s.analizados - a.s.analizados);
        return (
          <Seccion key={cat} titulo={`${c.icono} ${c.titulo}`} sub={`${ps.length} personajes · ${n(filas.reduce((a, f) => a + f.s.analizados, 0))} analizados`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filas.map(({ p, s }) => <Ficha key={p.id} s={s} nombre={p.nombre} acento={c.acento} />)}
            </div>
          </Seccion>
        );
      })}

      {multifirma.length > 0 && (
        <Seccion titulo="🎬 Multifirma" sub="pósters y fotos firmados por varios">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {multifirma.map((s) => <Ficha key={s.id} s={s} nombre={nombreDe(s.id)} acento="from-sky-500/10" />)}
          </div>
        </Seccion>
      )}
    </div>
  );
}
