// Diagnóstico 6: ¿respeta Vinted "más nuevos"? ¿Cuánto cambia la búsqueda de Wallapop entre dos lecturas?
import * as vinted from "./vinted.mjs";
import * as wallapop from "./wallapop.mjs";
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const general = await vinted.buscar("", 1, 0);
const maxGeneral = Math.max(...general.map((i) => Number(i.id)));
aviso("vinted-catalogo-general", `n=${general.length} id_max=${maxGeneral} primeros=${general.slice(0, 5).map((i) => i.id).join(",")}`);
for (const [q, min] of [["Leo Messi topps", 25], ["Leo Messi topps", 0], ["Lamine Yamal firmado", 0], ["messi", 0]]) {
  await dormir(5000);
  const it = await vinted.buscar(q, 1, min);
  const ids = it.map((i) => Number(i.id));
  const desc = ids.every((v, k) => k === 0 || v <= ids[k - 1]);
  aviso(`vinted "${q}" min${min}`, `n=${it.length} ordenado_desc=${desc} id_max=${Math.max(...ids)} (${Math.round((maxGeneral - Math.max(...ids)) / 1e3)}k por debajo del más nuevo) primeros=${ids.slice(0, 6).join(",")} · ${it.slice(0, 4).map((i) => i.title).join(" | ")}`);
}
const a = await wallapop.buscar("Leo Messi topps", 2, 25);
aviso("wallapop-ids", `n=${a.length} primeros=${a.slice(0, 5).map((i) => i.id).join(",")}`);
