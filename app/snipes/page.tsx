import { db } from "@/lib/supabase";
import { boton, Caja, eur, fecha, input, SinDatos } from "@/lib/ui";
import { actualizar, borrar, crear } from "./actions";
import { GixenBoton } from "./gixen-boton";

export const dynamic = "force-dynamic";

type Snipe = { id: number; ebay_item_id: string; title: string | null; url: string; ends_at: string | null; max_bid: number; notas: string | null; estado: string; precio_pagado: number | null; en_gixen: boolean; created_at: string };

const COLOR: Record<string, string> = { pendiente: "text-[#e8c35a]", ganada: "text-[#5cf08a]", perdida: "text-[#5f7364]" };

export default async function Snipes({ searchParams }: { searchParams: Promise<{ item?: string; title?: string }> }) {
  const pre = await searchParams;
  const { data } = await db().from("snipes").select("*").order("estado", { ascending: false }).order("ends_at", { ascending: true, nullsFirst: false }).limit(300);
  const snipes = (data ?? []) as Snipe[];
  const pendientes = snipes.filter((s) => s.estado === "pendiente");
  const ganadas = snipes.filter((s) => s.estado === "ganada");
  const pagado = ganadas.reduce((a, s) => a + Number(s.precio_pagado ?? 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Snipes (Gixen)</h1>

      <div className="grid grid-cols-3 gap-2">
        {[["Pendientes", String(pendientes.length)], ["Ganadas", String(ganadas.length)], ["Total pagado", eur(pagado)]].map(([k, v]) => (
          <div key={k} className="rounded border border-[#1f2a22] bg-[#0f1411] px-3 py-2">
            <p className="text-xs text-[#8fa394]">{k}</p><p className="text-lg font-bold">{v}</p>
          </div>
        ))}
      </div>

      <Caja titulo="Añadir snipe">
        <form action={crear} className="grid gap-2 p-4 sm:grid-cols-2">
          <input name="item" required defaultValue={pre.item} placeholder="URL de eBay o nº de artículo" className={input + " sm:col-span-2"} />
          <input name="title" defaultValue={pre.title} placeholder="Título (opcional)" className={input + " sm:col-span-2"} />
          <input name="max_bid" required inputMode="decimal" placeholder="Puja máxima (€)" className={input} />
          <label className="text-xs text-[#8fa394]">Fin de la subasta (opcional)
            <input name="ends_at" type="datetime-local" className={input} />
          </label>
          <textarea name="notas" placeholder="Notas" rows={2} className={input + " sm:col-span-2"} />
          <button className={boton + " sm:col-span-2"}>Guardar snipe</button>
        </form>
      </Caja>

      <Caja titulo="Mis snipes">
        {snipes.length === 0 ? <SinDatos>No hay snipes todavía.</SinDatos> : (
          <ul className="divide-y divide-[#1f2a22] text-sm">
            {snipes.map((s) => (
              <li key={s.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:text-[#5cf08a]">{s.title ?? `Artículo ${s.ebay_item_id}`}</a>
                  <span className={`text-xs ${COLOR[s.estado]}`}>[{s.estado}]</span>
                </div>
                <p className="text-xs text-[#8fa394]">
                  nº {s.ebay_item_id} · puja máx. <b className="text-[#d7e3d9]">{eur(s.max_bid)}</b>
                  {s.ends_at && <> · termina {fecha(s.ends_at)}</>}
                  {s.estado === "ganada" && <> · pagado <b className="text-[#d7e3d9]">{eur(s.precio_pagado)}</b></>}
                  {s.en_gixen && <span className="text-[#5cf08a]"> · ✔ en Gixen</span>}
                </p>
                {s.notas && <p className="text-xs text-[#d7e3d9]">📝 {s.notas}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {s.estado === "pendiente" && !s.en_gixen && <GixenBoton item={s.ebay_item_id} puja={Number(s.max_bid)} />}
                  {s.estado === "pendiente" && (
                    <form action={actualizar}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="en_gixen" value={s.en_gixen ? "0" : "1"} />
                      <button className="rounded border border-[#1f2a22] px-2 py-1 text-xs text-[#8fa394]">{s.en_gixen ? "Quitar marca Gixen" : "Ya está en Gixen"}</button></form>
                  )}
                  <form action={actualizar} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={s.id} />
                    <select name="estado" defaultValue={s.estado} className="rounded border border-[#1f2a22] bg-[#0a0d0b] px-2 py-1 text-xs">
                      <option value="pendiente">pendiente</option><option value="ganada">ganada</option><option value="perdida">perdida</option>
                    </select>
                    <input name="precio_pagado" defaultValue={s.precio_pagado ?? ""} inputMode="decimal" placeholder="Pagado €" className="w-24 rounded border border-[#1f2a22] bg-[#0a0d0b] px-2 py-1 text-xs" />
                    <button className="rounded border border-[#1f2a22] px-2 py-1 text-xs text-[#8fa394]">Guardar</button>
                  </form>
                  <form action={borrar}><input type="hidden" name="id" value={s.id} /><button className="px-1 text-xs text-[#f06b5c]">Borrar</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  );
}
