// Diagnóstico de nuevas webs: estructura de las respuestas (vía avisos de GitHub).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const aviso = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/[\r\n%]/g, " ").slice(0, 3900)}`);
const q = "messi firmado";

async function probar(nombre, url, headers = {}) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "es-ES,es;q=0.9", accept: "text/html,application/json", ...headers }, redirect: "follow" });
    const b = await r.text();
    const pist = {
      status: r.status, url: r.url, tipo: r.headers.get("content-type"), largo: b.length,
      nextData: b.includes("__NEXT_DATA__"), nextF: b.includes("self.__next_f"), jsonld: (b.match(/application\/ld\+json/g) ?? []).length,
      messi: (b.match(/messi/gi) ?? []).length, titulo: b.match(/<title>([^<]{0,100})/)?.[1],
    };
    aviso(nombre, JSON.stringify(pist));
    if (b.trim().startsWith("{") || b.trim().startsWith("[")) aviso(nombre + "-json", b.slice(0, 3800));
    else {
      const i = b.search(/messi/i);
      // primer bloque con un anuncio (alrededor de la 3.ª mención, que suele estar ya en los resultados)
      const ms = [...b.matchAll(/messi/gi)].map((m) => m.index);
      const k = ms[Math.min(4, ms.length - 1)] ?? i;
      if (k >= 0) aviso(nombre + "-ctx", b.slice(Math.max(0, k - 1800), k + 1800));
      const ld = b.match(/<script type="application\/ld\+json">([\s\S]{0,3800})/);
      if (ld) aviso(nombre + "-ld", ld[1]);
    }
  } catch (e) { aviso(nombre, "ERROR " + e.message); }
  await new Promise((s) => setTimeout(s, 3000));
}

await probar("wp-api-v3", `https://api.wallapop.com/api/v3/search?keywords=${encodeURIComponent(q)}&order_by=newest&source=search_box&latitude=40.4168&longitude=-3.7038`, { "x-deviceos": "0", accept: "application/json", origin: "https://es.wallapop.com", referer: "https://es.wallapop.com/" });
await probar("wp-api-general", `https://api.wallapop.com/api/v3/general/search?keywords=${encodeURIComponent(q)}&order_by=newest&latitude=40.4168&longitude=-3.7038`, { accept: "application/json" });
await probar("wp-web", `https://es.wallapop.com/app/search?keywords=${encodeURIComponent(q)}&order_by=newest`);
await probar("tc-buscador", `https://www.todocoleccion.net/buscador?bu=${encodeURIComponent(q)}&O=mas_recientes`);
await probar("tc-s", `https://www.todocoleccion.net/s/${q.replace(/ /g, "-")}`);
await probar("cw-web", `https://www.catawiki.com/es/s?q=${encodeURIComponent("messi")}`);
await probar("cw-api", `https://www.catawiki.com/buyer/api/v1/search?q=${encodeURIComponent("messi")}`, { accept: "application/json" });
