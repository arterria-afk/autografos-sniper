import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { personajes } from "@/lib/personajes";
import { fotoPublica } from "@/lib/fotos-url";
import { GraficaVentas } from "@/lib/grafica";
import { Caja, Cert, eur, fecha, Foto, SinDatos } from "@/lib/ui";

export const dynamic = "force-dynamic";
const TIPOS = ["todos", "foto", "camiseta", "balon", "tarjeta", "vinilo", "poster", "zapatilla", "otro"];

type L = { external_id: string; title: string; price: number; url: string; photo_url: string | null; photo_path: string | null; tipo: string; certificados: string[]; sold_at: string | null; seen_at: string; platform: string };

export default async function Personaje({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const { id } = await params;
  const { tipo = "todos" } = await searchParams;
  const p = personajes().find((x) => x.id === id);
  if (!p) notFound();

  const sel = "external_id,title,price,url,photo_url,photo_path,tipo,certificados,sold_at,seen_at,platform";
  let ventasQ = db().from("listings").select(sel).eq("personaje_id", id).eq("con_certificado", true).eq("status", "vendido").order("sold_at", { ascending: false }).limit(200);
  let abiertosQ = db().from("listings").select(sel).eq("personaje_id", id).eq("con_certificado", true).eq("status", "activo").order("price", { ascending: true }).limit(20);
  if (tipo !== "todos") { ventasQ = ventasQ.eq("tipo", tipo); abiertosQ = abiertosQ.eq("tipo", tipo); }
  const [{ data: v }, { data: a }] = await Promise.all([ventasQ, abiertosQ]);
  const ventas = (v ?? []) as L[], abiertos = (a ?? []) as L[];

  const precios = ventas.map((x) => Number(x.price)).sort((x, y) => x - y);
  const med = precios.length ? (precios.length % 2 ? precios[(precios.length - 1) / 2] : (precios[precios.length / 2 - 1] + precios[precios.length / 2]) / 2) : null;
  const foto = ventas.find((x) => x.photo_path || x.photo_url) ?? abiertos[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Foto src={foto ? fotoPublica(foto.photo_path, foto.photo_url) : null} alt={p.nombre} />
        <div>
          <h1 className="text-xl text-[#5cf08a]">{p.nombre}</h1>
          <p className="text-xs text-[#8fa394]">{p.categoria} · solo piezas con certificado</p>
        </div>
      </div>

      <form className="flex gap-2">
        <select name="tipo" defaultValue={tipo} className="rounded border border-[#1f2a22] bg-[#0f1411] px-3 py-2 text-sm">
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="rounded border border-[#5cf08a] px-3 text-sm text-[#5cf08a]">Filtrar</button>
      </form>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Ventas", String(precios.length)], ["Mínimo", eur(precios[0])], ["Mediana", eur(med)], ["Máximo", eur(precios.at(-1))]].map(([k, val]) => (
          <div key={k} className="rounded border border-[#1f2a22] bg-[#0f1411] px-3 py-2">
            <p className="text-xs text-[#8fa394]">{k}</p>
            <p className="text-lg font-bold">{val}</p>
          </div>
        ))}
      </div>

      <Caja titulo="Precio de ventas reales (Vinted)">
        <div className="p-2"><GraficaVentas mediana={med} puntos={ventas.filter((x) => x.sold_at).map((x) => ({ t: new Date(x.sold_at!).getTime(), precio: Number(x.price), titulo: x.title }))} /></div>
      </Caja>

      <Caja titulo="Ventas recientes">
        {ventas.length === 0 ? <SinDatos>Todavía no hay ventas detectadas.</SinDatos> : (
          <ul className="divide-y divide-[#1f2a22] text-sm">
            {ventas.slice(0, 15).map((x) => (
              <li key={x.external_id} className="flex items-center gap-3 px-4 py-2">
                <Foto src={fotoPublica(x.photo_path, x.photo_url)} alt="" />
                <div className="min-w-0 flex-1">
                  <a href={x.url} target="_blank" rel="noreferrer" className="block truncate hover:text-[#5cf08a]">{x.title}</a>
                  <p className="text-xs text-[#8fa394]">{x.tipo} · <Cert certs={x.certificados} /> · {fecha(x.sold_at)}</p>
                </div>
                <b className="shrink-0">{eur(x.price)}</b>
              </li>
            ))}
          </ul>
        )}
      </Caja>

      <Caja titulo="En venta ahora (más baratos primero)">
        {abiertos.length === 0 ? <SinDatos>No hay anuncios abiertos guardados.</SinDatos> : (
          <ul className="divide-y divide-[#1f2a22] text-sm">
            {abiertos.map((x) => (
              <li key={x.external_id} className="flex items-center justify-between gap-3 px-4 py-2">
                <a href={x.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:text-[#5cf08a]">{x.title}</a>
                <span className="shrink-0 text-xs text-[#8fa394]">{x.platform} · <b className="text-sm text-[#d7e3d9]">{eur(x.price)}</b></span>
              </li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  );
}
