import Link from "next/link";
import { db } from "@/lib/supabase";
import { jugadores, personajes } from "@/lib/personajes";
import { fotoPublica } from "@/lib/fotos-url";
import { FUENTE } from "@/lib/precio";
import { Caja, Cert, eur, fecha, Foto, SinDatos } from "@/lib/ui";
import { Votos } from "./votos";
import { resumenIA, type VeredictoIA } from "@/lib/ia";

export const dynamic = "force-dynamic";

type Deal = {
  id: number; price: number; ref_price: number | null; ref_source: keyof typeof FUENTE | null; ref_sample: number | null;
  descuento: number | null; es_chollo: boolean; created_at: string; photo_url: string | null; fb: string | null; fb_motivo: string | null;
  ia?: VeredictoIA | null; ia_descartado?: boolean; carta?: { kind: string; carta_desc: string | null } | null;
  listings: { title: string; url: string; platform: string; personaje_id: string; tipo: string; certificados: string[]; photo_path: string | null; status: string; descartado: boolean } | null;
};

const PLATAFORMAS = ["vinted", "wallapop", "ebay", "etsy"];
const sel = "border-[#5cf08a] text-[#5cf08a]", nosel = "border-[#1f2a22] text-[#8fa394]";

export default async function Chollos({ searchParams }: { searchParams: Promise<{ p?: string; per?: string; solo?: string; voto?: string; k?: string }> }) {
  const f = await searchParams;
  let q = db().from("deals")
    .select("id,listing_id,price,ref_price,ref_source,ref_sample,descuento,es_chollo,created_at,photo_url,fb,fb_motivo,listings!inner(title,url,platform,personaje_id,tipo,certificados,photo_path,status,descartado)")
    .order("created_at", { ascending: false }).limit(100);
  if (f.solo === "chollos") q = q.eq("es_chollo", true);
  if (f.voto === "sin") q = q.is("fb", null);
  if (f.voto !== "mal") q = q.eq("listings.descartado", false);
  if (f.p) q = q.eq("listings.platform", f.p);
  if (f.per) q = q.eq("listings.personaje_id", f.per);
  const { data: data0, error } = await q;
  let data = data0;
  // Con la migración 003: los que descartó la IA solo salen en "Descartados".
  const conIA = !error;
  if (conIA) {
    const ids = (data ?? []).map((d) => d.id);
    const { data: extra, error: e3 } = ids.length ? await db().from("deals").select("id,ia,ia_descartado").in("id", ids) : { data: [], error: null };
    if (!e3) {
      const m = new Map((extra ?? []).map((x) => [x.id, x]));
      data = (data ?? []).map((d) => ({ ...d, ...m.get(d.id) }));
      if (f.voto !== "mal") data = data.filter((d) => !(d as { ia_descartado?: boolean }).ia_descartado);
    }
  }
  // Con la migración 004: tipo de anuncio (carta/autógrafo) y descripción de la carta.
  {
    const lids = (data ?? []).map((d) => (d as { listing_id: number }).listing_id).filter(Boolean);
    const { data: ls, error: e4 } = lids.length ? await db().from("listings").select("id,kind,carta_desc").in("id", lids) : { data: [], error: null };
    if (!e4) {
      const m = new Map((ls ?? []).map((x) => [x.id, x]));
      data = (data ?? []).map((d) => ({ ...d, carta: m.get((d as { listing_id: number }).listing_id) ?? null }));
      if (f.k === "cartas") data = data.filter((d) => (d as { carta?: { kind: string } }).carta?.kind === "carta");
      if (f.k === "autografos") data = data.filter((d) => (d as { carta?: { kind: string } }).carta?.kind !== "carta");
    }
  }
  type Fila = { fb: string | null; ia_descartado?: boolean; listings: { descartado: boolean } | null };
  if (f.voto === "mal") data = (data ?? []).filter((d) => { const x = d as unknown as Fila; return x.fb === "mal" || x.ia_descartado || x.listings?.descartado; });
  const deals = (data ?? []) as unknown as Deal[];
  const nombre = (id?: string) => [...personajes(), ...jugadores()].find((p) => p.id === id)?.nombre ?? id;
  const url = (cambio: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...f, ...cambio }).filter(([, v]) => v) as [string, string][]);
    return `/chollos${u.size ? "?" + u : ""}`;
  };
  const chip = (href: string, activo: boolean, txt: string) => (
    <Link href={href} className={`rounded border px-2 py-1 text-xs ${activo ? sel : nosel}`}>{txt}</Link>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Chollos</h1>
      <div className="flex flex-wrap gap-2">
        {chip(url({ solo: undefined }), !f.solo, "Todo")}
        {chip(url({ solo: "chollos" }), f.solo === "chollos", "🔥 Solo chollos")}
        <span className="w-2" />
        {chip(url({ voto: undefined }), !f.voto, "Todos")}
        {chip(url({ voto: "sin" }), f.voto === "sin", "Sin votar")}
        {chip(url({ voto: "mal" }), f.voto === "mal", "❌ Descartados")}
      </div>
      <div className="flex flex-wrap gap-2">
        {chip(url({ k: undefined }), !f.k, "Cartas y autógrafos")}
        {chip(url({ k: "cartas" }), f.k === "cartas", "🃏 Cartas")}
        {chip(url({ k: "autografos" }), f.k === "autografos", "✍️ Autógrafos")}
      </div>
      <div className="flex flex-wrap gap-2">
        {chip(url({ p: undefined }), !f.p, "Todas las webs")}
        {PLATAFORMAS.map((p) => chip(url({ p }), f.p === p, p))}
      </div>
      <form className="flex gap-2">
        {Object.entries(f).filter(([k, v]) => k !== "per" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <select name="per" defaultValue={f.per ?? ""} className="rounded border border-[#1f2a22] bg-[#0f1411] px-2 py-1 text-xs">
          <option value="">Todos los personajes</option>
          {[...new Map([...personajes(), ...jugadores()].map((p) => [p.id, p])).values()].map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <button className="rounded border border-[#1f2a22] px-2 text-xs text-[#8fa394]">Filtrar</button>
      </form>

      {error && <p className="text-sm text-[#f06b5c]">Error de base de datos: {error.message}. ¿Has ejecutado la migración 002 en Supabase?</p>}
      <Caja>
        {deals.length === 0 ? <SinDatos>No hay nada con estos filtros.</SinDatos> : (
          <ul className="divide-y divide-[#1f2a22]">
            {deals.map((d) => (
              <li key={d.id} className="flex gap-3 px-4 py-3">
                <Foto src={fotoPublica(d.listings?.photo_path, d.photo_url)} alt="" />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-bold">
                      {d.es_chollo ? <span className="text-[#ff8a3d]">🔥 −{d.descuento}% </span> : "🆕 "}
                      <Link href={`/personaje/${d.listings?.personaje_id}`} className="hover:text-[#5cf08a]">{nombre(d.listings?.personaje_id)}</Link>
                    </span>
                    <span className="text-xs text-[#5f7364]">{fecha(d.created_at)} · {d.listings?.platform}</span>
                  </div>
                  {d.carta?.kind === "carta" && <p className="text-xs text-[#5cf08a]">🃏 {d.carta.carta_desc}</p>}
                  <a href={d.listings?.url} target="_blank" rel="noreferrer" className="block truncate hover:text-[#5cf08a]">{d.listings?.title}</a>
                  <div className="flex flex-wrap gap-x-4 text-xs">
                    <span className="text-base font-bold">{eur(d.price)}</span>
                    <span className="text-[#8fa394]">ref. {d.ref_price && d.ref_source ? `${eur(d.ref_price)} (${FUENTE[d.ref_source]}, ${d.ref_sample})` : "sin referencia"}</span>
                    {d.carta?.kind !== "carta" && <Cert certs={d.listings?.certificados ?? []} />}
                    {d.listings?.status && d.listings.status !== "activo" && <span className="text-[#e8c35a]">{d.listings.status}</span>}
                  </div>
                  {d.ia && <p className={`text-xs ${d.ia_descartado ? "text-[#f06b5c]" : d.ia.riesgo === "medio" ? "text-[#e8c35a]" : "text-[#8fa394]"}`}>{d.ia_descartado ? "Descartado · " : ""}{resumenIA(d.ia)}</p>}
                  <Votos id={d.id} fb={d.fb} motivo={d.fb_motivo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  );
}
