// Diagnóstico 8: ¿se lee bien la descripción de los anuncios de Vinted?
import * as vinted from "./vinted.mjs";
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 1500)}`);
const items = await vinted.buscar("Leo Messi firmado", 1, 0);
for (const it of items.slice(0, 5)) {
  await new Promise((s) => setTimeout(s, 4000));
  const d = await vinted.descripcion(it.url);
  aviso(`desc ${it.id}`, `${it.title} ⇒ ${d === null ? "(null)" : JSON.stringify(d.slice(0, 600))}`);
}
