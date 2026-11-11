import { reconocer } from "@/lib/recognize";
import { personajes } from "@/lib/personajes";
import { referenciaCarta, resolverReferencia, juzgar, FUENTE } from "@/lib/precio";
import { reconocerCarta } from "@/lib/cartas";
import { jugadores } from "@/lib/personajes";
import { leerAnuncio } from "@/lib/leer-anuncio";
import { boton, Caja, Cert, Enlace, eur, fecha, Foto, input } from "@/lib/ui";

export const dynamic = "force-dynamic";

const MOTIVOS: Record<string, string> = {
  sin_personaje: "No reconozco a ningún personaje de tu lista en el título.",
  ambiguo: "Aparecen varios personajes; no puedo saber cuál es.",
  excluido: "Parece una copia, preprint, réplica o firma impresa.",
  lote: "Es un lote: no se puede valorar como una sola pieza.",
  sin_firma: "El título no dice que esté firmado.",
};

export default async function Valorar({ searchParams }: { searchParams: Promise<{ q?: string; precio?: string }> }) {
  const { q = "", precio: precioTxt = "" } = await searchParams;
  const texto = q.trim();
  let titulo = texto, foto: string | null = null, url: string | null = null;
  let precio = precioTxt ? Number(precioTxt.replace(",", ".")) : null;
  let avisoLectura: string | null = null;

  if (/^https?:\/\//i.test(texto)) {
    const a = await leerAnuncio(texto);
    if (a) { titulo = a.titulo; foto = a.foto; url = a.url; precio ??= a.precio; }
    else { avisoLectura = "No he podido leer el enlace (la web lo bloquea o no es de Vinted/Wallapop/eBay). Pega el título del anuncio."; titulo = ""; }
  }

  const carta = titulo ? reconocerCarta(titulo, jugadores()) : null;
  const esCarta = !!carta?.ok;
  const r = titulo && !esCarta ? reconocer(titulo, personajes()) : null;
  const ref = carta?.ok ? await referenciaCarta(carta.clave) : r?.ok && r.conCertificado ? await resolverReferencia(r.personaje.id, r.tipo) : null;
  const juicio = ref && precio ? juzgar(precio, ref) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Valorar un anuncio</h1>
      <form className="space-y-2">
        <input name="q" defaultValue={texto} placeholder="Pega el enlace o el título del anuncio" className={input} />
        <div className="flex gap-2">
          <input name="precio" defaultValue={precioTxt} inputMode="decimal" placeholder="Precio (opcional)" className={input + " max-w-40"} />
          <button className={boton}>Valorar</button>
        </div>
      </form>

      {avisoLectura && <p className="text-sm text-[#e8c35a]">{avisoLectura}</p>}

      {carta?.ok && (
        <Caja titulo="Carta reconocida">
          <div className="flex gap-3 px-4 py-3 text-sm">
            <Foto src={foto} alt="" />
            <div className="min-w-0 space-y-1">
              <p className="truncate">{url ? <a href={url} target="_blank" rel="noreferrer" className="hover:text-[#5cf08a]">{titulo}</a> : titulo}</p>
              <p className="text-[#5cf08a]">🃏 {carta.descripcion}</p>
              {precio != null && <p>Precio pedido: <b>{eur(precio)}</b></p>}
            </div>
          </div>
          <div className="border-t border-[#1f2a22] px-4 py-3 text-sm">
            {!ref ? (
              <p className="text-[#e8c35a]">Todavía no hay ventas registradas de esta carta exacta (misma colección, paralela, numeración y nota). El robot las irá recogiendo de Vinted y Wallapop.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-base">Vale aprox. <b className="text-[#5cf08a]">{eur(ref.precio)}</b>
                  <span className="text-xs text-[#8fa394]"> · {FUENTE[ref.fuente]} · {ref.muestra} ventas</span></p>
                {juicio?.descuento != null && (
                  <p className={juicio.esChollo ? "text-[#ff8a3d]" : "text-[#8fa394]"}>
                    {juicio.esChollo ? `🔥 Chollo: ${juicio.descuento}% por debajo` : juicio.descuento >= 0 ? `${juicio.descuento}% por debajo de la referencia` : `${-juicio.descuento}% por encima de la referencia`}
                  </p>
                )}
                <ul className="space-y-1 text-xs">
                  {ref.comps.map((c, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-[#5cf08a]">{c.title}</a> : c.title}</span>
                      <span className="shrink-0 text-[#8fa394]">{eur(c.price)} · {c.fuente}{c.fecha ? ` · ${fecha(c.fecha)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Caja>
      )}

      {r && !r.ok && (
        <Caja><p className="px-4 py-4 text-sm text-[#f06b5c]">✘ {MOTIVOS[r.motivo] ?? r.motivo}{r.detalle ? ` (${r.detalle})` : ""}</p></Caja>
      )}

      {r?.ok && (
        <Caja titulo="Resultado">
          <div className="flex gap-3 px-4 py-3 text-sm">
            <Foto src={foto} alt="" />
            <div className="min-w-0 space-y-1">
              <p className="truncate">{url ? <a href={url} target="_blank" rel="noreferrer" className="hover:text-[#5cf08a]">{titulo}</a> : titulo}</p>
              <p><Enlace href={`/personaje/${r.personaje.id}`}>{r.personaje.nombre}</Enlace> · {r.tipo}{r.tamano ? ` ${r.tamano}` : ""} · <Cert certs={r.certificados} coa={r.coaGenerico} /></p>
              {precio != null && <p>Precio pedido: <b>{eur(precio)}</b></p>}
            </div>
          </div>
          <div className="border-t border-[#1f2a22] px-4 py-3 text-sm">
            {!r.conCertificado ? (
              <p className="text-[#f06b5c]">Sin certificado reconocido: no lo valoro. Una firma sin certificado no se puede comparar con las certificadas y el riesgo de falsificación es alto.</p>
            ) : !ref ? (
              <p className="text-[#e8c35a]">No sé cuánto vale: todavía no hay suficientes ventas ni anuncios comparables. Prefiero no darte un precio malo.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-base">Vale aprox. <b className="text-[#5cf08a]">{eur(ref.precio)}</b>
                  <span className="text-xs text-[#8fa394]"> · {ref.fuente === "vinted_sold" ? "mediana de ventas reales en Vinted" : "percentil 25 de anuncios en eBay"} · {ref.muestra} muestras{ref.nivel > 1 ? " · tipo parecido" : ""}</span>
                </p>
                {juicio?.descuento != null && (
                  <p className={juicio.esChollo ? "text-[#ff8a3d]" : "text-[#8fa394]"}>
                    {juicio.esChollo ? `🔥 Chollo: ${juicio.descuento}% por debajo` : juicio.descuento >= 0 ? `${juicio.descuento}% por debajo de la referencia` : `${-juicio.descuento}% por encima de la referencia`}
                  </p>
                )}
                {juicio?.aviso && <p className="text-[#e8c35a]">⚠️ {juicio.aviso}</p>}
                <ul className="space-y-1 text-xs">
                  {ref.comps.map((c, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-[#5cf08a]">{c.title}</a> : c.title}</span>
                      <span className="shrink-0 text-[#8fa394]">{eur(c.price)} · {c.fuente}{c.fecha ? ` · ${fecha(c.fecha)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Caja>
      )}
    </div>
  );
}
