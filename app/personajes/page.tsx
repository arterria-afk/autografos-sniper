import { personajes } from "@/lib/personajes";
import { Caja } from "@/lib/ui";

export default function Personajes() {
  const lista = personajes();
  const cats = [...new Set(lista.map((p) => p.categoria))];
  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Personajes</h1>
      {cats.map((c) => (
        <Caja key={c} titulo={c}>
          <ul className="divide-y divide-[#1f2a22] text-sm">
            {lista.filter((p) => p.categoria === c).map((p) => (
              <li key={p.id}><a href={`/personaje/${p.id}`} className="block px-4 py-2 hover:text-[#5cf08a]">{p.nombre}</a></li>
            ))}
          </ul>
        </Caja>
      ))}
      <p className="text-xs text-[#5f7364]">Para añadir o quitar personajes, edita <code>data/personajes.txt</code> en GitHub (o pídeselo a Claude).</p>
    </div>
  );
}
