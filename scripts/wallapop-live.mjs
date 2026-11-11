// Lee los anuncios más nuevos de Wallapop y los manda a la web (mismo proceso que Vinted).
import { bucle, dormir, pausa, personajes, web } from "./comun.mjs";
import { buscar, Bloqueado } from "./wallapop.mjs";

const PALABRAS = (process.env.PALABRAS ?? "firmado,autografo,signed").split(",");

await bucle(async () => {
  const total = { recibidos: 0, reconocidos: 0, nuevos: 0, alertas: 0 };
  for (const p of personajes()) {
    for (const palabra of PALABRAS) {
      let items;
      try { items = await buscar(`${p.nombre} ${palabra}`); }
      catch (e) { if (e instanceof Bloqueado) { console.warn(`${e.message} → pausa de 30 min`); await dormir(30 * 60e3); continue; } throw e; }
      await pausa();
      if (!items.length) continue;
      const r = await web("/api/vinted", { items, mode: "live", platform: "wallapop" });
      for (const k of Object.keys(total)) total[k] += r[k] ?? 0;
      console.log(`${p.nombre} "${palabra}": ${items.length} anuncios, ${r.reconocidos} reconocidos, ${r.nuevos} nuevos, ${r.alertas} alertas`);
    }
  }
  console.log("Pasada terminada:", total);
  console.log(`::notice title=pasada wallapop::${JSON.stringify(total)}`);
});
