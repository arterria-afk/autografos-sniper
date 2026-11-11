// Lee los anuncios de Wallapop (autógrafos y cartas) y los manda a la web.
import { bucle, busquedas, dormir, pausa, web } from "./comun.mjs";
import { buscar, Bloqueado } from "./wallapop.mjs";

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, cartas: 0, nuevos: 0, alertas: 0 };
  for (const b of busquedas()) {
    let items;
    try { items = await buscar(b.texto, 2, b.min); }
    catch (e) { if (e instanceof Bloqueado) { console.warn(`${e.message} → pausa de 30 min`); await dormir(30 * 60e3); continue; } throw e; }
    await pausa();
    if (!items.length) continue;
    const r = await web("/api/vinted", { items, mode: "live", platform: "wallapop" });
    for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
    console.log(`"${b.texto}": ${items.length} anuncios, ${r.reconocidos} reconocidos (${r.cartas} cartas), ${r.nuevos} nuevos`);
  }
  console.log("Pasada terminada:", total);
  console.log(`::notice title=pasada wallapop::${JSON.stringify(total)}`);
});
