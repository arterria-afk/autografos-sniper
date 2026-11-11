// Reconocedor de CARTAS: título → carta exacta (jugador, colección, temporada, paralela, numeración, nota, auto).
// Solo interesan cartas con valor: numeradas, graduadas o con autógrafo. Precisión antes que cantidad.
import { normalizar } from "./recognize.ts";

export type Jugador = { id: string; nombre: string; tipo: string; alias: string[] };
export type Carta = {
  ok: true; jugador: Jugador; marca: string; coleccion: string; temporada: string | null;
  paralela: string | null; numerada: number | null; rc: boolean; auto: boolean;
  grado: string | null; // "PSA 10", "BGS 9.5"…
  clave: string; // identifica la carta exacta para comparar precios
  descripcion: string;
};
export type CartaRechazo = { ok: false; motivo: string; detalle?: string };

const tiene = (t: string, f: string) => t.includes(" " + normalizar(f).trim() + " ");
const algun = (t: string, fs: string[]) => fs.find((f) => tiene(t, f));

export function parseJugadores(txt: string): Jugador[] {
  return txt.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
    const [id, nombre, tipo, alias] = l.split("|").map((x) => x.trim());
    return { id, nombre, tipo, alias: alias.split(",").map((a) => a.trim()).filter(Boolean) };
  });
}

// Colecciones (de más específica a más general). [marca, colección, frases]
const COLECCIONES: [string, string, string[]][] = [
  ["Topps", "Chrome Sapphire", ["chrome sapphire", "sapphire"]],
  ["Topps", "Chrome UCC", ["chrome ucc", "chrome uefa", "topps chrome champions"]],
  ["Topps", "Chrome", ["topps chrome", "chrome"]],
  ["Topps", "Finest", ["finest"]],
  ["Topps", "Merlin", ["merlin"]],
  ["Topps", "Inception", ["inception"]],
  ["Topps", "Museum Collection", ["museum collection", "museum"]],
  ["Topps", "Dynasty", ["dynasty"]],
  ["Topps", "Deco", ["deco"]],
  ["Topps", "Stadium Club", ["stadium club"]],
  ["Topps", "Gold", ["topps gold"]],
  ["Topps", "Now", ["topps now"]],
  ["Topps", "Match Attax", ["match attax"]],
  ["Topps", "UCC", ["ucc", "uefa club competitions", "topps champions league"]],
  ["Panini", "Prizm", ["prizm"]],
  ["Panini", "Select", ["select"]],
  ["Panini", "Obsidian", ["obsidian"]],
  ["Panini", "Mosaic", ["mosaic"]],
  ["Panini", "Donruss", ["donruss"]],
  ["Panini", "Immaculate", ["immaculate"]],
  ["Panini", "National Treasures", ["national treasures"]],
  ["Panini", "Flawless", ["flawless"]],
  ["Panini", "Megacracks", ["megacracks", "mega cracks"]],
  ["Panini", "Adrenalyn XL", ["adrenalyn", "adrenalyn xl"]],
  ["Futera", "Futera", ["futera"]],
  ["Leaf", "Leaf", ["leaf"]],
  ["Upper Deck", "Upper Deck", ["upper deck"]],
  ["Topps", "Topps", ["topps"]],
  ["Panini", "Panini", ["panini"]],
];

// Paralelas (colores y acabados). Orden: compuestas primero.
const PARALELAS = [
  "superfractor", "gold refractor", "orange refractor", "red refractor", "green refractor", "blue refractor", "purple refractor",
  "black refractor", "pink refractor", "aqua refractor", "sepia refractor", "magenta refractor", "gold wave", "red wave",
  "blue wave", "green wave", "orange wave", "purple wave", "x fractor", "xfractor", "speckle", "mojo", "shimmer", "lava",
  "atomic", "raywave", "geometric", "mini diamond", "cracked ice", "lazer", "laser", "disco", "tie dye", "camo", "snakeskin",
  "gold", "orange", "red", "green", "blue", "purple", "black", "pink", "aqua", "silver", "bronze", "white", "yellow",
  "refractor", "wave", "prizm silver", "holo",
];

const EXCLUIR = ["lote", "lot", "lots", "bundle", "job lot", "x2", "x3", "x4", "x5", "pack", "sobre", "sobres", "caja", "box", "blaster",
  "hobby box", "elige", "pick", "choose", "a elegir", "custom", "fan made", "reprint", "proxy", "replica", "copia", "digital",
  "album", "coleccion completa", "set completo", "complete set", "repetidas", "intercambio", "faltas"];

export function reconocerCarta(titulo: string, jugadores: Jugador[]): Carta | CartaRechazo {
  // "PSA8" → "PSA 8", "BGS9.5" → "BGS 9.5"
  const t = normalizar(titulo.replace(/\b(psa|bgs|sgc|cgc)(\d)/gi, "$1 $2"));

  const encontrados = jugadores.filter((j) => j.alias.some((a) => tiene(t, a)));
  if (!encontrados.length) return { ok: false, motivo: "sin_jugador" };
  if (encontrados.length > 1) return { ok: false, motivo: "ambiguo", detalle: encontrados.map((j) => j.nombre).join(" / ") };
  const jugador = encontrados[0];

  const ex = algun(t, EXCLUIR);
  if (ex) return { ok: false, motivo: "excluido", detalle: ex };

  // Varias cartas en un anuncio (dos notas, dos numeraciones o "+ otra carta") = lote.
  const notas = t.match(/ (psa|bgs|sgc|cgc) (10|[1-9]) /g)?.length ?? 0;
  const sinTemporadas = t.replace(/ (\d{2}|\d{4}) \/ (\d{2}|\d{4}) /g, (m, a, b) => ((Number(b.slice(-2)) - Number(a.slice(-2)) + 100) % 100 === 1 ? " " : m));
  const numeraciones = sinTemporadas.match(/ \/ \d{1,4} /g)?.length ?? 0;
  const mas = /\+\s*\d*\s*(psa|cartas?|cromos?|cards?|gold|ficha|regalo)/i.test(titulo);
  if (notas > 1 || numeraciones > 1 || mas) return { ok: false, motivo: "varias_cartas" };

  const col = COLECCIONES.find(([, , fs]) => algun(t, fs));
  const esCarta = col || algun(t, ["card", "carta", "cromo", "tarjeta", "rookie", "rc", "psa", "bgs", "sgc"]);
  if (!esCarta) return { ok: false, motivo: "no_es_carta" };

  // Nota de gradación: "PSA 10", "BGS 9.5", "SGC 9", "CGC 9.5" (las notas pegadas a la empresa).
  const g = t.match(/ (psa|bgs|sgc|cgc|beckett) (10|[1-9](?: 5)?) /);
  const grado = g ? `${g[1] === "beckett" ? "BGS" : g[1].toUpperCase()} ${g[2].replace(" 5", ".5")}` : null;

  // Numeración de fábrica: "/50", "1/1", "23/99"; no confundir con temporadas "2024/25".
  let numerada: number | null = null;
  const sinTemp = t.replace(/ (\d{2}|\d{4}) \/ (\d{2}|\d{4}) /g, (m, a, b) => ((Number(b.slice(-2)) - Number(a.slice(-2)) + 100) % 100 === 1 ? " " : m));
  const n = sinTemp.match(/ (?:\d{1,4} )?\/ (\d{1,4}) /) ?? sinTemp.match(/ (1) of (1) /);
  if (n) numerada = Number(n[1]);
  if (tiene(t, "1 / 1") || tiene(t, "one of one") || tiene(t, "superfractor")) numerada = 1;

  const auto = !!algun(t, ["auto", "autos", "autograph", "autographed", "autografo", "autografiada", "autografiado", "firmada", "firmado", "signed", "on card auto", "rpa"]);
  const rc = !!algun(t, ["rc", "rookie", "rookie card"]);

  // Solo cartas con valor: numeradas, graduadas o con autógrafo.
  if (!numerada && !grado && !auto) return { ok: false, motivo: "sin_valor", detalle: "ni numerada, ni graduada, ni auto" };

  const tm = t.match(/ (20\d{2}|19\d{2}) (?:\/ |)(\d{2}|\d{4}) /) ?? t.match(/ (\d{2}) (?:\/ )?(\d{2}) /);
  let temporada: string | null = null;
  if (tm) {
    const a = Number(tm[1].slice(-2)), b = Number(tm[2].slice(-2));
    if ((b - a + 100) % 100 === 1) temporada = `${String(a).padStart(2, "0")}/${String(b).padStart(2, "0")}`;
  }
  if (!temporada) { const y = t.match(/ (20[0-3]\d|19[5-9]\d) /); if (y) temporada = y[1]; }

  const paralela = PARALELAS.find((p) => tiene(t, p)) ?? null;
  const [marca, coleccion] = col ? [col[0], col[1]] : ["?", "?"];

  const clave = [jugador.id, coleccion, temporada ?? "?", paralela ?? "base", numerada ? `/${numerada}` : "-", grado ?? "raw", auto ? "auto" : "-"].join("|").toLowerCase();
  const descripcion = [jugador.nombre, marca !== "?" ? (coleccion === marca ? marca : `${marca} ${coleccion}`) : null, temporada, paralela, numerada ? `/${numerada}` : null, rc ? "RC" : null, auto ? "Auto" : null, grado]
    .filter(Boolean).join(" · ");
  return { ok: true, jugador, marca, coleccion, temporada, paralela, numerada, rc, auto, grado, clave, descripcion };
}
