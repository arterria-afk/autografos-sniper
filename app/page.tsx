const MODULOS = [
  { n: 1, t: "Esqueleto web + comprobación de claves", estado: "hecho" },
  { n: 2, t: "Base de datos (Supabase) + bot de Telegram", estado: "pendiente" },
  { n: 3, t: "Catálogo de personajes + reconocedor de autógrafos", estado: "en marcha" },
  { n: 4, t: "Alertas de eBay (todos los mercados)", estado: "pendiente" },
  { n: 5, t: "Vinted en directo (cada 15 min)", estado: "pendiente" },
  { n: 6, t: "Detector de ventas reales en Vinted", estado: "pendiente" },
  { n: 7, t: "Precio de referencia (ventas + eBay)", estado: "pendiente" },
  { n: 8, t: "Juez de chollos + votos en Telegram", estado: "pendiente" },
  { n: 9, t: "Página «Valorar»", estado: "pendiente" },
  { n: 10, t: "Página por personaje con gráfica", estado: "pendiente" },
  { n: 11, t: "Snipes con Gixen (modo manual)", estado: "pendiente" },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl text-[#5cf08a]">Sniper de autógrafos certificados</h1>
        <p className="mt-2 text-sm text-[#8fa394]">
          Solo piezas con certificado reconocido: PSA/DNA, Beckett/BAS, JSA, Upper Deck, Panini, Fanatics.
        </p>
      </section>
      <section className="rounded border border-[#1f2a22] bg-[#0f1411]">
        <h2 className="border-b border-[#1f2a22] px-4 py-2 text-sm text-[#8fa394]">Hoja de ruta</h2>
        <ul className="divide-y divide-[#1f2a22] text-sm">
          {MODULOS.map((m) => (
            <li key={m.n} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>
                <span className="text-[#5f7364]">{String(m.n).padStart(2, "0")}</span> {m.t}
              </span>
              <span className={m.estado === "hecho" ? "text-[#5cf08a]" : "text-[#5f7364]"}>
                [{m.estado}]
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
