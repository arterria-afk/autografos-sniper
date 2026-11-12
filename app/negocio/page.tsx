import { db } from "@/lib/supabase";
import { personajes } from "@/lib/personajes";
import { fotoPublica } from "@/lib/fotos-url";
import { boton, Caja, eur, Foto, input, SinDatos } from "@/lib/ui";
import { borrarPieza, comprar, deshacerVenta, vender } from "./actions";
import { FotoInput } from "./foto-input";

export const dynamic = "force-dynamic";

type Pieza = {
  id: number; personaje_id: string | null; descripcion: string; tipo: string | null; certificado: string | null; cert_numero: string | null;
  foto_path: string | null; comprado_en: string | null; fecha_compra: string | null; precio_compra: number; gastos_compra: number;
  estado: string; vendido_en: string | null; fecha_venta: string | null; precio_venta: number | null; gastos_venta: number; notas: string | null;
};

const TIPOS = ["foto", "camiseta", "balon", "tarjeta", "vinilo", "poster", "zapatilla", "otro"];
const CERTS = ["PSA/DNA", "Beckett", "JSA", "Upper Deck", "Panini", "Topps", "Leaf", "Futera", "Fanatics", "Otro COA"];
const coste = (p: Pieza) => Number(p.precio_compra) + Number(p.gastos_compra);
const beneficio = (p: Pieza) => Number(p.precio_venta ?? 0) - Number(p.gastos_venta) - coste(p);
const dias = (desde: string | null, hasta?: string | null) => !desde ? null : Math.max(0, Math.round(((hasta ? new Date(hasta) : new Date()).getTime() - new Date(desde).getTime()) / 864e5));
const hoy = () => new Date().toISOString().slice(0, 10);

export default async function Negocio({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver = "stock" } = await searchParams;
  const { data, error } = await db().from("inventario").select("*").order("fecha_compra", { ascending: false, nullsFirst: false }).limit(1000);
  const piezas = (data ?? []) as Pieza[];
  const stock = piezas.filter((p) => p.estado === "en_stock");
  const vendidas = piezas.filter((p) => p.estado === "vendida");
  const mes = hoy().slice(0, 7);
  const delMes = vendidas.filter((p) => p.fecha_venta?.startsWith(mes));
  const nombre = (id: string | null) => personajes().find((p) => p.id === id)?.nombre ?? (id || "—");

  const porPersonaje = Object.entries(vendidas.reduce<Record<string, { n: number; b: number }>>((a, p) => {
    const k = nombre(p.personaje_id); a[k] ??= { n: 0, b: 0 }; a[k].n++; a[k].b += beneficio(p); return a;
  }, {})).sort((a, b) => b[1].b - a[1].b);

  const tiles: [string, string, string?][] = [
    ["En stock", `${stock.length} piezas`, eur(stock.reduce((a, p) => a + coste(p), 0)) + " invertido"],
    ["Ventas este mes", String(delMes.length), eur(delMes.reduce((a, p) => a + Number(p.precio_venta), 0))],
    ["Beneficio este mes", eur(delMes.reduce((a, p) => a + beneficio(p), 0))],
    ["Beneficio total", eur(vendidas.reduce((a, p) => a + beneficio(p), 0)), vendidas.length ? `margen medio ${Math.round(vendidas.reduce((a, p) => a + (coste(p) ? beneficio(p) / coste(p) : 0), 0) / vendidas.length * 100)}%` : undefined],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Mi negocio</h1>
      {error && <p className="text-sm text-[#f06b5c]">Error de base de datos: {error.message}. ¿Has ejecutado la migración 002 en Supabase?</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="rounded border border-[#1f2a22] bg-[#0f1411] px-3 py-2">
            <p className="text-xs text-[#8fa394]">{k}</p><p className="text-lg font-bold">{v}</p>
            {sub && <p className="text-xs text-[#5f7364]">{sub}</p>}
          </div>
        ))}
      </div>

      <details className="rounded border border-[#1f2a22] bg-[#0f1411]">
        <summary className="cursor-pointer px-4 py-2 text-sm text-[#5cf08a]">＋ Añadir compra</summary>
        <form action={comprar} className="grid gap-2 p-4 sm:grid-cols-2">
          <input name="descripcion" required placeholder="Qué es (p. ej. Camiseta Barça firmada Messi)" className={input + " sm:col-span-2"} />
          <select name="personaje_id" defaultValue="" className={input}>
            <option value="">Personaje…</option>
            {personajes().map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select name="tipo" defaultValue="" className={input}>
            <option value="">Tipo…</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select name="certificado" defaultValue="" className={input}>
            <option value="">Sin certificado</option>{CERTS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input name="cert_numero" placeholder="Nº de certificado" className={input} />
          <input name="comprado_en" placeholder="Dónde (eBay, Vinted, feria…)" className={input} />
          <input name="fecha_compra" type="date" defaultValue={hoy()} className={input} />
          <input name="precio_compra" required inputMode="decimal" placeholder="Precio pagado €" className={input} />
          <input name="gastos_compra" inputMode="decimal" placeholder="Gastos € (envío, aduana, autenticación)" className={input} />
          <textarea name="notas" rows={2} placeholder="Notas" className={input + " sm:col-span-2"} />
          <FotoInput />
          <button className={boton}>Guardar compra</button>
        </form>
      </details>

      <div className="flex gap-3 text-sm">
        <a href="/negocio" className={ver === "stock" ? "text-[#5cf08a]" : "text-[#8fa394]"}>En stock ({stock.length})</a>
        <a href="/negocio?ver=vendidas" className={ver === "vendidas" ? "text-[#5cf08a]" : "text-[#8fa394]"}>Vendidas ({vendidas.length})</a>
        <a href="/negocio?ver=personajes" className={ver === "personajes" ? "text-[#5cf08a]" : "text-[#8fa394]"}>Por personaje</a>
      </div>

      {ver === "personajes" ? (
        <Caja titulo="Beneficio por personaje">
          {porPersonaje.length === 0 ? <SinDatos>Aún no has vendido nada.</SinDatos> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-[#8fa394]"><th className="px-4 py-2">Personaje</th><th className="px-4 py-2 text-right">Ventas</th><th className="px-4 py-2 text-right">Beneficio</th></tr></thead>
              <tbody className="divide-y divide-[#1f2a22]">
                {porPersonaje.map(([k, v]) => <tr key={k}><td className="px-4 py-2">{k}</td><td className="px-4 py-2 text-right">{v.n}</td><td className={`px-4 py-2 text-right font-bold ${v.b >= 0 ? "text-[#5cf08a]" : "text-[#f06b5c]"}`}>{eur(v.b)}</td></tr>)}
              </tbody>
            </table>
          )}
        </Caja>
      ) : (
        <Caja>
          {(ver === "vendidas" ? vendidas : stock).length === 0 ? <SinDatos>{ver === "vendidas" ? "Aún no has vendido nada." : "No tienes piezas en stock. Añade tu primera compra arriba."}</SinDatos> : (
            <ul className="divide-y divide-[#1f2a22] text-sm">
              {(ver === "vendidas" ? vendidas : stock).map((p) => (
                <li key={p.id} className="space-y-2 px-4 py-3">
                  <div className="flex gap-3">
                    <Foto src={fotoPublica(p.foto_path)} alt="" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{p.descripcion}</p>
                      <p className="text-xs text-[#8fa394]">
                        {nombre(p.personaje_id)}{p.tipo ? ` · ${p.tipo}` : ""} · {p.certificado ? <span className="text-[#5cf08a]">✔ {p.certificado}{p.cert_numero ? ` #${p.cert_numero}` : ""}</span> : <span className="text-[#f06b5c]">sin certificado</span>}
                      </p>
                      <p className="text-xs text-[#8fa394]">
                        Compra {p.fecha_compra ?? "(sin fecha)"}{p.comprado_en ? ` en ${p.comprado_en}` : ""}: <b className="text-[#d7e3d9]">{eur(coste(p))}</b>
                        {Number(p.gastos_compra) > 0 && ` (${eur(p.precio_compra)} + ${eur(p.gastos_compra)} gastos)`}
                        {p.estado === "en_stock" && dias(p.fecha_compra) != null && ` · ${dias(p.fecha_compra)} días en stock`}
                      </p>
                      {p.estado === "vendida" && (
                        <p className="text-xs text-[#8fa394]">
                          Venta {p.fecha_venta ?? "(sin fecha)"}{p.vendido_en ? ` en ${p.vendido_en}` : ""}: <b className="text-[#d7e3d9]">{eur(p.precio_venta)}</b>
                          {" → "}<b className={beneficio(p) >= 0 ? "text-[#5cf08a]" : "text-[#f06b5c]"}>{beneficio(p) >= 0 ? "+" : ""}{eur(beneficio(p))}</b>
                          {coste(p) > 0 && ` (${Math.round((beneficio(p) / coste(p)) * 100)}%)`}{dias(p.fecha_compra, p.fecha_venta) != null && ` · ${dias(p.fecha_compra, p.fecha_venta)} días`}
                        </p>
                      )}
                      {p.notas && <p className="text-xs">📝 {p.notas}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.estado === "en_stock" ? (
                      <details>
                        <summary className="cursor-pointer rounded border border-[#5cf08a] px-2 py-1 text-xs text-[#5cf08a]">Marcar vendida</summary>
                        <form action={vender} className="mt-2 grid grid-cols-2 gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          <input name="precio_venta" required inputMode="decimal" placeholder="Precio venta €" className={input} />
                          <input name="gastos_venta" inputMode="decimal" placeholder="Comisiones/envío €" className={input} />
                          <input name="vendido_en" placeholder="Dónde" className={input} />
                          <input name="fecha_venta" type="date" defaultValue={hoy()} className={input} />
                          <button className={boton + " col-span-2"}>Guardar venta</button>
                        </form>
                      </details>
                    ) : (
                      <form action={deshacerVenta}><input type="hidden" name="id" value={p.id} /><button className="rounded border border-[#1f2a22] px-2 py-1 text-xs text-[#8fa394]">Deshacer venta</button></form>
                    )}
                    <form action={borrarPieza}><input type="hidden" name="id" value={p.id} /><button className="px-1 text-xs text-[#f06b5c]">Borrar</button></form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Caja>
      )}
    </div>
  );
}
