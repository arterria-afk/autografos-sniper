// Reconocedor de autógrafos: título de anuncio → personaje + tipo + certificado.
// Regla de oro: precisión antes que cantidad. Si hay duda, se rechaza.

export type Personaje = { id: string; nombre: string; categoria: string; alias: string[] };

export type Certificado = "PSA/DNA" | "Beckett" | "JSA" | "Upper Deck" | "Panini" | "Topps" | "Leaf" | "Futera" | "Fanatics";
export type Tipo = "foto" | "camiseta" | "balon" | "poster" | "vinilo" | "tarjeta" | "zapatilla" | "otro";

export type Reconocido = {
  ok: true;
  personaje: Personaje;
  tipo: Tipo;
  tamano: string | null; // 8x10, 11x14… (fotos y pósters)
  certificados: Certificado[];
  conCertificado: boolean;
  coaGenerico: boolean; // dice "COA" pero sin empresa reconocida → riesgo
  confianza: "alta" | "media";
};
export type Rechazado = { ok: false; motivo: string; detalle?: string };
export type Resultado = Reconocido | Rechazado;

// ---------- normalización ----------
export function normalizar(s: string): string {
  return (
    " " +
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita acentos
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9/]+/g, " ") // todo lo raro → espacio
      .replace(/\//g, " / ")
      .replace(/\s+/g, " ")
      .trim() +
    " "
  );
}
const tiene = (t: string, frase: string) => t.includes(" " + normalizar(frase).trim() + " ");
const algun = (t: string, frases: string[]) => frases.some((f) => tiene(t, f));

// ---------- vocabulario (ES/EN/FR/IT/DE/PT) ----------
const FIRMA = [
  "signed", "hand signed", "autograph", "autographed", "autographs", "auto", "autos", "autograf", "autografi",
  "firmado", "firmada", "firmados", "firma", "autografo", "autografiado", "autografiada", "dedicado", "dedicada",
  "signe", "signee", "dedicace", "dedicacee", "autographe",
  "firmato", "firmata", "autografato", "autografata", "autografo",
  "signiert", "handsigniert", "unterschrieben", "autogramm", "autogrammkarte",
  "assinado", "assinada", "autografado", "autografada",
];
// Si aparece cualquiera de estas, NUNCA es un autógrafo bueno.
const EXCLUIR_SIEMPRE = [
  "preprint", "pre print", "pre printed", "preprinted", "facsimile", "facsimil", "fac simile",
  "reprint", "re print", "copy", "copia", "copie", "kopie", "reproduction", "reproduccion", "riproduzione",
  "printed signature", "printed autograph", "printed auto", "firma impresa", "firma impreso", "autografo impreso",
  "autopen", "stamped signature", "stamp signature", "firma estampada", "laser signature", "secretarial",
  "unsigned", "not signed", "sin firmar", "sin firma", "no firmado", "no firmada", "non signe", "non firmato",
  "nicht signiert", "ohne autogramm",
  // firmas impresas / estampadas / bordadas
  "serigrafiado", "serigrafiada", "serigrafia", "serigrafato", "serigrafata", "stampato", "stampata", "autografo stampato",
  "impreso", "impresa", "printed", "ricamata", "ricamato", "bordado", "bordada", "embroidered", "hot signature",
  "facsimile signature", "firma facsimil", "gedruckt",
  // obras de arte firmadas por el artista, no por el personaje
  "dibujo", "acuarela", "pintura", "drawing", "painting", "illustration", "ilustracion", "fan art", "opera firmata",
  "dessin", "aquarelle", "disegno", "acquerello", "zeichnung",
];
// Lotes: no se pueden valorar como una pieza.
const LOTE = ["lote", "lot", "lots", "bundle", "job lot", "pack de", "set de", "x2", "x3", "x4", "x5", "x10", "collection of", "coleccion de", "konvolut"];
// "replica" se excluye salvo que haya certificado reconocido
// (una camiseta "replica" de aficionado puede estar firmada de verdad y certificada).
const REPLICA = ["replica", "replika", "replique", "fake", "falso", "falsa", "imitacion"];

// Autentificadores de firmas. OJO: "PSA 9" o "Beckett 8.5" es la NOTA de la tarjeta, no la firma.
const CERTS: { cert: Certificado; frases: string[] }[] = [
  { cert: "PSA/DNA", frases: ["psa / dna", "psa dna", "psadna", "psa authentic", "psa authenticated", "psa auth", "psa coa", "psa loa",
    "psa certified", "psa certificado", "psa certificada", "certificado psa", "certificada psa", "certificado por psa", "psa autograph", "psa auto", "psa encapsulated"] },
  { cert: "Beckett", frases: ["bas coa", "bas cert", "bas certified", "bas authenticated", "bas witness", "bas witnessed", "bas sticker", "bas loa",
    "beckett authentication", "beckett authenticated", "beckett coa", "beckett loa", "beckett witness", "beckett witnessed", "beckett certificado",
    "certificado beckett", "certificada beckett", "certificacion beckett", "beckett certified", "beckett authentic"] },
  { cert: "JSA", frases: ["jsa", "james spence"] },
  { cert: "Upper Deck", frases: ["upper deck authenticated", "upper deck authentication", "uda"] },
  { cert: "Fanatics", frases: ["fanatics", "fanatics authentic"] },
];
// "psa" / "beckett" a secas cuentan solo si NO van seguidos de una nota (número).
const sueltoSinNota = (t: string, marca: string) => new RegExp(` ${marca} (?!(\\d|gem|mint|grade|graded|nm)\\b)`).test(t) || t.endsWith(` ${marca} `);

// Descripción con relleno de palabras clave → no sirve para decidir.
const RELLENO = ["psa", "beckett", "jsa", "panini", "topps", "leaf", "futera", "upper deck", "fanatics", "pokemon", "charizard", "pikachu", "one piece"];
export function descripcionUtil(d?: string | null): string {
  if (!d) return "";
  if (/no leer|tags?:|keywords|etiquetas|palabras clave/i.test(d)) return "";
  const n = normalizar(d);
  if (RELLENO.filter((w) => tiene(n, w)).length >= 4) return "";
  return d.slice(0, 1500);
}

const COA_GENERICO = ["coa", "loa", "certificado", "certificate", "certificat", "certificato", "zertifikat", "echtheitszertifikat"];
const COA_NEGADO = ["no coa", "without coa", "sin coa", "sin certificado", "no certificate", "ohne zertifikat", "senza certificato"];

const TIPOS: { tipo: Tipo; frases: string[] }[] = [
  { tipo: "tarjeta", frases: ["card", "cards", "carta", "cartas", "tarjeta", "tarjetas", "cromo", "trading card", "rookie", "rc", "topps", "leaf", "futera", "prizm", "select", "optic", "chrome", "refractor", "sammelkarte", "figurina", "carte"] },
  { tipo: "camiseta", frases: ["jersey", "camiseta", "shirt", "maillot", "maglia", "trikot", "camisola", "kit"] },
  { tipo: "balon", frases: ["ball", "balon", "basketball", "football ball", "soccer ball", "pallone", "fussball", "ballon", "bola"] },
  { tipo: "vinilo", frases: ["vinyl", "vinilo", "lp", "record", "album", "disco", "vinile", "schallplatte", "cd"] },
  { tipo: "poster", frases: ["poster", "cartel", "affiche", "lithograph", "litografia"] },
  { tipo: "zapatilla", frases: ["shoe", "shoes", "sneaker", "sneakers", "zapatilla", "zapatillas", "boot", "boots", "bota", "botas", "chaussure", "scarpa"] },
  { tipo: "foto", frases: ["photo", "foto", "photograph", "fotografia", "picture", "8x10", "11x14", "16x20", "12x18", "bild"] },
];

// Detrás de "firmado por / autografo di / signed by…" tiene que venir el personaje.
const POR = ["firmado por", "firmada por", "firmados por", "firmadas por", "autografo de", "autografo di", "autografato da", "autografata da",
  "firmato da", "firmata da", "signed by", "autographed by", "signe par", "signee par", "signiert von", "autogramm von", "assinado por", "assinada por"];
const COMODIN = new Set(["el", "la", "los", "las", "il", "lo", "the", "le", "der", "die", "o", "a", "original", "originale", "autentico", "autentica", "real", "authentic"]);
function firmanteDistinto(t: string, p: Personaje): string | null {
  for (const f of POR) {
    const i = t.indexOf(" " + f + " ");
    if (i < 0) continue;
    const resto = t.slice(i + f.length + 2).split(" ").filter((w) => w && !COMODIN.has(w));
    const siguiente = " " + resto.slice(0, 4).join(" ") + " ";
    if (!p.alias.some((a) => siguiente.includes(" " + normalizar(a).trim() + " "))) return resto.slice(0, 2).join(" ");
  }
  return null;
}

// ---------- catálogo ----------
export function parsePersonajes(txt: string): Personaje[] {
  return txt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [id, nombre, categoria, alias] = l.split("|").map((x) => x.trim());
      return { id, nombre, categoria, alias: alias.split(",").map((a) => a.trim()).filter(Boolean) };
    });
}

// ---------- reconocedor ----------
export function reconocer(titulo: string, personajes: Personaje[], descripcion = ""): Resultado {
  const t = normalizar(titulo);
  const todo = normalizar(titulo + " " + descripcionUtil(descripcion));

  // 1) Personaje: exactamente uno.
  const encontrados = personajes.filter((p) => algun(t, p.alias));
  if (encontrados.length === 0) return { ok: false, motivo: "sin_personaje" };
  if (encontrados.length > 1)
    return { ok: false, motivo: "ambiguo", detalle: encontrados.map((p) => p.nombre).join(" / ") };
  const personaje = encontrados[0];

  // 1b) "autógrafo de / signed by / firmado por" + otra persona → firma otro (p. ej. el director de Thriller).
  const otro = firmanteDistinto(t, personaje);
  if (otro) return { ok: false, motivo: "firma_otro", detalle: otro };

  // 2) Exclusiones.
  const excl = EXCLUIR_SIEMPRE.find((f) => tiene(todo, f));
  if (excl) return { ok: false, motivo: "excluido", detalle: excl };
  if (algun(t, LOTE)) return { ok: false, motivo: "lote" };

  // 3) Tiene que decir que está firmado.
  if (!algun(t, FIRMA)) return { ok: false, motivo: "sin_firma" };

  // 4) Certificados.
  const certificados = CERTS.filter((c) => algun(todo, c.frases)).map((c) => c.cert);
  if (!certificados.includes("PSA/DNA") && sueltoSinNota(todo, "psa")) certificados.push("PSA/DNA");
  if (!certificados.includes("Beckett") && sueltoSinNota(todo, "beckett")) certificados.push("Beckett");
  const tipo = TIPOS.find((x) => algun(t, x.frases))?.tipo ?? "otro";
  // Fabricantes de tarjetas (Panini, Topps, Leaf, Futera): un cromo firmado a mano NO está certificado.
  // Solo cuenta "<marca> authentic" o una TARJETA con autógrafo de fábrica ("auto", "on card"…).
  const autoFabrica = tipo === "tarjeta" && algun(t, ["auto", "autos", "autograph", "autographs", "autograf", "rpa", "on card", "on card auto", "sticker auto", "signature series", "signatures"]) ||
    // "autógrafo" + numerada de fábrica (/7, /25, /99…) = autógrafo de fábrica
    (tipo === "tarjeta" && algun(t, ["autografo", "autografiada", "autografata", "autographed", "signed", "firmada", "firmado"]) && / \/ \d{1,4} /.test(t));
  for (const marca of ["Panini", "Topps", "Leaf", "Futera", "Upper Deck"] as const) {
    const m = marca.toLowerCase();
    if (certificados.includes(marca)) continue;
    if (tiene(todo, `${m} authentic`) || (tiene(t, m) && autoFabrica)) certificados.push(marca);
  }
  const conCertificado = certificados.length > 0;
  const coaGenerico = !conCertificado && algun(todo, COA_GENERICO) && !algun(todo, COA_NEGADO);

  // 5) "replica": fuera, salvo con certificado reconocido.
  const rep = REPLICA.find((f) => tiene(todo, f));
  if (rep && !conCertificado) return { ok: false, motivo: "excluido", detalle: rep };

  const tamano = t.match(/ (8x10|11x14|16x20|12x18|20x24|24x36) /)?.[1] ?? null;

  return {
    ok: true,
    personaje,
    tipo,
    tamano,
    certificados,
    conCertificado,
    coaGenerico,
    confianza: conCertificado && tipo !== "otro" ? "alta" : "media",
  };
}
