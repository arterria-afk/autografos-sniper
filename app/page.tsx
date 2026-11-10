import Link from "next/link";
import { db } from "@/lib/supabase";
import { personajes } from "@/lib/personajes";
import { fotoPublica } from "@/lib/fotos-url";
import { Caja, Cert, eur, fecha, Foto, SinDatos } from "@/lib/ui";

export const dynamic = "force-dynamic";

type Deal = {
  id: number; price: number; ref_price: number | null; ref_source: string | null; ref_sample: number | null;
  descuento: number | null; es_chollo: boolean; created_at: string; photo_url: string | null;
  listings: { title: string; url: string; platform: string; personaje_id: string; tipo: string; certificados: string[]; photo_path: string | null; status: string } | null;
};

export default async function Alertas({ searchParams }: { searchParams: Promise<{ solo?: string }> }) {
  const { solo } = await searchParams;
  let q = db().from("deals")
    .select("id,price,ref_price,ref_source,ref_sample,descuento,es_chollo,created_at,photo_url,listings(title,url,platform,personaje_id,tipo,certificados,photo_path,status)")
    .order("created_at", { ascending: false }).limit(60);
  if (solo === "chollos") q = q.eq("es_chollo", true);
  const { data, error } = await q;
  const deals = (data ?? []) as unknown as Deal[];
  const nombre = (id?: string) => personajes().find((p) => p.id === id)?.nombre ?? id;
  const hoy = deals.filter((d) => Date.now() - new Date(d.created_at).getTime() < 864e5).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl text-[#5cf08a]">Alertas <span className="text-sm text-[#8fa394]">· {hoy} en 24 h</span></h1>
        <div className="flex gap-3 text-sm">
          <Link href="/" className={!solo ? "text-[#5cf08a]" : "text-[#8fa394]"}>Todas</Link>
          <Link href="/?solo=chollos" className={solo ? "text-[#5cf08a]" : "text-[#8fa394]"}>🔥 Solo chollos</Link>
        </div>
      </div>
      {error && <p className="text-sm text-[#f06b5c]">Error de base de datos: {error.message}</p>}
      <Caja>
        {deals.length === 0 ? (
          <SinDatos>Aún no hay alertas. Llegarán cuando Vinted encuentre piezas certificadas nuevas.</SinDatos>
        ) : (
          <ul className="divide-y divide-[#1f2a22]">
            {deals.map((d) => (
              <li key={d.id} className="flex gap-3 px-4 py-3">
                <Foto src={fotoPublica(d.listings?.photo_path, d.photo_url)} alt="" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-bold">
                      {d.es_chollo ? <span className="text-[#ff8a3d]">🔥 −{d.descuento}% </span> : "🆕 "}
                      <a href={`/personaje/${d.listings?.personaje_id}`} className="hover:text-[#5cf08a]">{nombre(d.listings?.personaje_id)}</a>
                    </span>
                    <span className="text-xs text-[#5f7364]">{fecha(d.created_at)} · {d.listings?.platform}</span>
                  </div>
                  <a href={d.listings?.url} target="_blank" rel="noreferrer" className="block truncate text-[#d7e3d9] hover:text-[#5cf08a]">{d.listings?.title}</a>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs">
                    <span className="text-base font-bold text-[#d7e3d9]">{eur(d.price)}</span>
                    <span className="text-[#8fa394]">ref. {d.ref_price ? `${eur(d.ref_price)} (${d.ref_source === "vinted_sold" ? "ventas" : "eBay"}, ${d.ref_sample})` : "sin referencia"}</span>
                    <Cert certs={d.listings?.certificados ?? []} />
                    {d.listings?.status && d.listings.status !== "activo" && <span className="text-[#e8c35a]">{d.listings.status}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  );
}
