import { db } from "@/lib/supabase";
import { personajes } from "@/lib/personajes";
import { fotoPublica } from "@/lib/fotos-url";
import { Caja, Cert, eur, fecha, Foto, SinDatos } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function Ventas() {
  const { data } = await db().from("listings")
    .select("external_id,title,price,url,photo_url,photo_path,tipo,certificados,coa_generico,sold_at,personaje_id")
    .eq("status", "vendido").order("sold_at", { ascending: false }).limit(100);
  const nombre = (id: string) => personajes().find((p) => p.id === id)?.nombre ?? id;
  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Historial de ventas reales</h1>
      <Caja>
        {!data?.length ? <SinDatos>Aún no se ha detectado ninguna venta en Vinted.</SinDatos> : (
          <ul className="divide-y divide-[#1f2a22] text-sm">
            {data.map((x) => (
              <li key={x.external_id} className="flex items-center gap-3 px-4 py-2">
                <Foto src={fotoPublica(x.photo_path, x.photo_url)} alt="" />
                <div className="min-w-0 flex-1">
                  <a href={`/personaje/${x.personaje_id}`} className="font-bold hover:text-[#5cf08a]">{nombre(x.personaje_id)}</a>
                  <a href={x.url} target="_blank" rel="noreferrer" className="block truncate hover:text-[#5cf08a]">{x.title}</a>
                  <p className="text-xs text-[#8fa394]">{x.tipo} · <Cert certs={x.certificados} coa={x.coa_generico} /> · {fecha(x.sold_at)}</p>
                </div>
                <b className="shrink-0">{eur(x.price)}</b>
              </li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  );
}
