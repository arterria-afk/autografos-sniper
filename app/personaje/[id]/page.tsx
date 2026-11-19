import Link from "next/link";
import { enlace } from "@/lib/enlaces";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { personajes } from "@/lib/personajes";
import { fotoPublica } from "@/lib/fotos-url";
import { GraficaVentas } from "@/lib/grafica";
import { Caja, Cert, eur, fecha, Foto, SinDatos } from "@/lib/ui";

export const dynamic = "force-dynamic";
// Pósters primero: son las piezas más interesantes.
const TIPOS: [string, string, string][] = [
  ["poster", "🎬", "Pósters"], ["foto", "📸", "Fotos"], ["camiseta", "👕", "Camisetas"], ["balon", "⚽", "Balones"],
  ["vinilo", "💿", "Vinilos / CD"], ["documento", "📜", "Cartas y documentos"], ["zapatilla", "👟", "Zapatillas"], ["otro", "📦", "Otros"],
];

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
  const resumenQ = db().from("listings").select("tipo,status,price").eq("personaje_id", id).eq("con_certificado", true).eq("descartado", false).neq("tipo", "tarjeta").limit(5000);
  const [{ data: v }, { data: a }, { data: r }] = await Promise.all([ventasQ, abiertosQ, resumenQ]);
  const porTipo = new Map<string, { n: number; ventas: number[] }>();
  for (const x of (r ?? []) as { tipo: string; status: string; price: number }[]) {
    const g = porTipo.get(x.tipo) ?? { n: 0, ventas: [] };
    g.n++;
    if (x.status === "vendido" && x.price > 0) g.ventas.push(Number(x.price));
    porTipo.set(x.tipo, g);
  }
  const mediana = (xs: number[]) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b), m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
  const ventas = (v ?? []) as L[], abiertos = (a ?? []) as L[];

  const precios = ventas.map((x) => Number(x.price)).sort((x, y) => x - y);
  const med = precios.length ? (precios.length % 2 ? precios[(precios.length - 1) / 2] : (precios[precios.length / 2 - 1] + precios[precios.length / 2]) / 2) : null;
  const foto = ventas.find((x) => x.photo_path || x.photo_url) ?? abiertos[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Foto src={foto ? fotoPublica(foto.photo_path, foto.photo_url) : null} alt={p.nombre} />
        <div>
          <h1 className="text-2xl font-bold">{p.nombre}</h1>
          <p className="text-xs text-[#8fa394]">{p.categoria} · solo piezas con certificado</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <Link href={`/chollos?per=${encodeURIComponent(id)}&k=autografos&solo=chollos`} className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-300 hover:bg-amber-400/25">🔥 Ver sus chollos</Link>
            <Link href={`/chollos?per=${encodeURIComponent(id)}&k=autografos&solo=oport`} className="rounded-full bg-white/5 px-3 py-1 text-slate-300 hover:bg-white/10">💡 Oportunidades</Link>
            <Link href={`/chollos?per=${encodeURIComponent(id)}&k=autografos`} className="rounded-full bg-white/5 px-3 py-1 text-slate-300 hover:bg-white/10">Todo lo encontrado</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link href={`/personaje/${encodeURIComponent(id)}`}
          className={`rounded-xl border px-3 py-2 ${tipo === "todos" ? "border-[#5cf08a] bg-[#5cf08a]/10" : "border-[#1f2a22] bg-[#0f1411] hover:border-[#5cf08a]/50"}`}>
          <p className="text-sm font-semibold">✨ Todo</p>
          <p className="text-xs text-[#8fa394]">{(r ?? []).length} anuncios</p>
        </Link>
        {TIPOS.filter(([t]) => porTipo.has(t) || t === "poster" || t === "foto").map(([t, ico, nombre]) => {
          const g = porTipo.get(t) ?? { n: 0, ventas: [] };
          return (
            <Link key={t} href={`/personaje/${encodeURIComponent(id)}?tipo=${t}`}
              className={`rounded-xl border px-3 py-2 ${tipo === t ? "border-[#5cf08a] bg-[#5cf08a]/10" : t === "poster" ? "border-amber-400/40 bg-amber-400/5 hover:border-amber-400" : "border-[#1f2a22] bg-[#0f1411] hover:border-[#5cf08a]/50"}`}>
              <p className="text-sm font-semibold">{ico} {nombre}</p>
              <p className="text-xs text-[#8fa394]">{g.n} anuncios · {g.ventas.length} ventas</p>
              {g.ventas.length > 0 && <p className="text-xs">mediana <b>{eur(mediana(g.ventas))}</b></p>}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Ventas", String(precios.length)], ["Mínimo", eur(precios[0])], ["Mediana", eur(med)], ["Máximo", eur(precios.at(-1))]].map(([k, val]) => (
          <div key={k} className="rounded border border-[#1f2a22] bg-[#0f1411] px-3 py-2">
            <p className="text-xs text-[#8fa394]">{k}</p>
            <p className="text-lg font-bold">{val}</p>
          </div>
        ))}
      </div>

      <Caja titulo={`Precio de ventas reales${tipo !== "todos" ? ` · solo ${(TIPOS.find(([t]) => t === tipo) ?? ["", "", tipo])[2].toLowerCase()}` : ""}`}>
        <div className="p-2"><GraficaVentas mediana={med} puntos={ventas.filter((x) => x.sold_at).map((x) => ({ t: new Date(x.sold_at!).getTime(), precio: Number(x.price), titulo: x.title }))} /></div>
      </Caja>

      <Caja titulo="Ventas recientes">
        {ventas.length === 0 ? <SinDatos>Todavía no hay ventas detectadas.</SinDatos> : (
          <ul className="divide-y divide-[#1f2a22] text-sm">
            {ventas.slice(0, 15).map((x) => (
              <li key={x.external_id} className="flex items-center gap-3 px-4 py-2">
                <Foto src={fotoPublica(x.photo_path, x.photo_url)} alt="" />
                <div className="min-w-0 flex-1">
                  <a href={enlace(x.url)} target="_blank" rel="noreferrer" className="block truncate hover:text-[#5cf08a]">{x.title}</a>
                  <p className="text-xs text-[#8fa394]">{(TIPOS.find(([t]) => t === x.tipo) ?? ["", "📦", x.tipo])[1]} {x.tipo} · <Cert certs={x.certificados} /> · {fecha(x.sold_at)}</p>
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
                <a href={enlace(x.url)} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:text-[#5cf08a]">{x.title}</a>
                <span className="shrink-0 text-xs text-[#8fa394]">{x.platform} · <b className="text-sm text-[#d7e3d9]">{eur(x.price)}</b></span>
              </li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  );
}
