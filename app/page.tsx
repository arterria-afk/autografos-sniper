import Link from "next/link";
import { db } from "@/lib/supabase";
import { personajes } from "@/lib/personajes";
import { fotoPublica } from "@/lib/fotos-url";
import { Caja, eur, fecha, Foto, SinDatos } from "@/lib/ui";

export const dynamic = "force-dynamic";

const hace = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const cuenta = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

export default async function Inicio() {
  const L = () => db().from("listings").select("id", { count: "exact", head: true });
  const D = () => db().from("deals").select("id", { count: "exact", head: true });
  const [vistos24, nuevos24, cert24, ventas7, alertas7, chollos7, sinVotar, ultimo, votos, inv, recientes] = await Promise.all([
    cuenta(L().gte("last_seen_at", hace(24))),
    cuenta(L().gte("seen_at", hace(24))),
    cuenta(L().gte("seen_at", hace(24)).eq("con_certificado", true)),
    cuenta(L().eq("status", "vendido").gte("sold_at", hace(24 * 7))),
    cuenta(D().gte("created_at", hace(24 * 7))),
    cuenta(D().gte("created_at", hace(24 * 7)).eq("es_chollo", true)),
    cuenta(D().is("fb", null)),
    db().from("listings").select("last_seen_at").order("last_seen_at", { ascending: false }).limit(1).maybeSingle(),
    db().from("deals").select("fb").not("fb", "is", null).limit(1000),
    db().from("inventario").select("estado,precio_compra,gastos_compra,precio_venta,gastos_venta,fecha_venta").limit(2000),
    db().from("deals").select("id,price,descuento,es_chollo,created_at,photo_url,listings!inner(title,url,platform,personaje_id,photo_path,descartado)")
      .eq("listings.descartado", false).order("created_at", { ascending: false }).limit(6),
  ]);

  const ultimaPasada = ultimo.data?.last_seen_at as string | undefined;
  const minutos = ultimaPasada ? Math.round((Date.now() - new Date(ultimaPasada).getTime()) / 60e3) : null;
  const vs = (votos.data ?? []) as { fb: string }[];
  const pct = (v: string) => (vs.length ? Math.round((vs.filter((x) => x.fb === v).length / vs.length) * 100) : 0);
  const piezas = (inv.data ?? []) as { estado: string; precio_compra: number; gastos_compra: number; precio_venta: number | null; gastos_venta: number; fecha_venta: string | null }[];
  const mes = new Date().toISOString().slice(0, 7);
  const benef = (p: (typeof piezas)[number]) => Number(p.precio_venta ?? 0) - Number(p.gastos_venta) - Number(p.precio_compra) - Number(p.gastos_compra);
  const stock = piezas.filter((p) => p.estado === "en_stock");
  const nombre = (id?: string) => personajes().find((p) => p.id === id)?.nombre ?? id;

  const Tile = ({ k, v, sub, href }: { k: string; v: string; sub?: string; href?: string }) => {
    const c = (
      <div className="h-full rounded border border-[#1f2a22] bg-[#0f1411] px-3 py-2 hover:border-[#5cf08a]/50">
        <p className="text-xs text-[#8fa394]">{k}</p><p className="text-lg font-bold">{v}</p>{sub && <p className="text-xs text-[#5f7364]">{sub}</p>}
      </div>
    );
    return href ? <Link href={href}>{c}</Link> : c;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl text-[#5cf08a]">Panel</h1>
        <p className={`text-xs ${minutos != null && minutos < 40 ? "text-[#5cf08a]" : "text-[#e8c35a]"}`}>
          {minutos == null ? "Robot sin datos todavía" : minutos < 40 ? `● Robot activo · última pasada hace ${minutos} min` : `● Robot parado hace ${Math.round(minutos / 60)} h — revisa GitHub Actions`}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm text-[#8fa394]">Chollos</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile k="Anuncios revisados (24 h)" v={String(vistos24)} sub={`${nuevos24} nuevos · ${cert24} certificados`} />
          <Tile k="Alertas (7 días)" v={String(alertas7)} sub={`${chollos7} 🔥 chollos`} href="/chollos" />
          <Tile k="Sin votar" v={String(sinVotar)} sub="entrena al robot" href="/chollos?voto=sin" />
          <Tile k="Aciertos del robot" v={vs.length ? `${pct("bueno")}%` : "—"} sub={vs.length ? `🤔 ${pct("duda")}% · ❌ ${pct("mal")}% · ${vs.length} votos` : "aún sin votos"} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm text-[#8fa394]">Mi negocio</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile k="En stock" v={`${stock.length} piezas`} sub={eur(stock.reduce((a, p) => a + Number(p.precio_compra) + Number(p.gastos_compra), 0)) + " invertido"} href="/negocio" />
          <Tile k="Beneficio este mes" v={eur(piezas.filter((p) => p.fecha_venta?.startsWith(mes)).reduce((a, p) => a + benef(p), 0))} href="/negocio?ver=vendidas" />
          <Tile k="Beneficio total" v={eur(piezas.filter((p) => p.estado === "vendida").reduce((a, p) => a + benef(p), 0))} href="/negocio?ver=personajes" />
          <Tile k="Ventas reales detectadas (7 d)" v={String(ventas7)} sub="referencias de precio" href="/ventas" />
        </div>
      </section>

      <Caja titulo="Últimas alertas" extra={<Link href="/chollos" className="text-xs text-[#5cf08a]">Ver todas →</Link>}>
        {!recientes.data?.length ? <SinDatos>Aún no hay alertas.</SinDatos> : (
          <ul className="divide-y divide-[#1f2a22] text-sm">
            {(recientes.data as unknown as { id: number; price: number; descuento: number | null; es_chollo: boolean; created_at: string; photo_url: string | null; listings: { title: string; url: string; platform: string; personaje_id: string; photo_path: string | null } }[]).map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2">
                <Foto src={fotoPublica(d.listings.photo_path, d.photo_url)} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{d.es_chollo ? <span className="text-[#ff8a3d]">🔥 −{d.descuento}% </span> : "🆕 "}{nombre(d.listings.personaje_id)}</p>
                  <a href={d.listings.url} target="_blank" rel="noreferrer" className="block truncate text-xs hover:text-[#5cf08a]">{d.listings.title}</a>
                  <p className="text-xs text-[#5f7364]">{fecha(d.created_at)} · {d.listings.platform}</p>
                </div>
                <b className="shrink-0">{eur(d.price)}</b>
              </li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  );
}
