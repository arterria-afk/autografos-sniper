// Reconocedor de autógrafos: título de anuncio → personaje + tipo + certificado.
// Regla de oro: precisión antes que cantidad. Si hay duda, se rechaza.

export type Personaje = { id: string; nombre: string; categoria: string; alias: string[]; noConfundir?: string[] };

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
  "nicht signiert", "ohne autogramm", "repro", "repros", "reprint", "reprints", "autograph reprints", "hwc trading", "hwc", "vordruck", "impresion autografa", "printed autograph",
  "statue", "estatua", "busto", "bust", "bronze", "bronce", "skulptur", "escultura", "sculpture", "gemalde", "pop art", "art print", "lamina", "aufdruck", "gedruckte unterschrift", "print signature", "no eminem", "not signed by",
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
  { cert: "Beckett", frases: ["bas slab", "bas losa", "bas encapsulated", "beckett slab", "beckett encapsulated", "bas coa", "bas cert", "bas certified", "bas authenticated", "bas witness", "bas witnessed", "bas sticker", "bas loa",
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
  { tipo: "tarjeta", frases: ["card", "cards", "carta", "cartas", "tarjeta", "tarjetas", "cromo", "trading card", "rookie", "rc", "topps", "leaf", "futera", "score board", "scoreboard", "skybox", "fleer", "hoops", "bowman", "totally certified", "prizm", "select", "optic", "chrome", "refractor", "sammelkarte", "figurina", "carte"] },
  { tipo: "camiseta", frases: ["jersey", "camiseta", "shirt", "maillot", "maglia", "trikot", "camisola", "kit"] },
  { tipo: "balon", frases: ["ball", "balon", "basketball", "football ball", "soccer ball", "pallone", "fussball", "ballon", "bola"] },
  { tipo: "vinilo", frases: ["vinyl", "vinilo", "lp", "record", "album", "disco", "vinile", "schallplatte", "cd"] },
  { tipo: "poster", frases: ["poster", "cartel", "affiche", "lithograph", "litografia"] },
  { tipo: "zapatilla", frases: ["shoe", "shoes", "sneaker", "sneakers", "zapatilla", "zapatillas", "boot", "boots", "bota", "botas", "chaussure", "scarpa"] },
  { tipo: "foto", frases: ["photo", "foto", "photograph", "fotografia", "picture", "8x10", "11x14", "16x20", "12x18", "bild"] },
];

// Detrás de "firmado por / autografo di / signed by…" tiene que venir el personaje.
const POR = ["firmado por", "firmada por", "firmados por", "firmadas por", "autografiado por", "autografiada por", "autografo de", "autografo di", "autografato da", "autografata da",
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

// Numerada de fábrica ("/25", "1/1", "88/230") pero NO temporada ("2024/25", "09/10", "2024/2025").
function numerada(t: string): boolean {
  const sin = t.replace(/ (\d{2}|\d{4}) \/ (\d{2}|\d{4}) /g, (m, a, b) => {
    const x = Number(a.slice(-2)), y = Number(b.slice(-2));
    return (y - x + 100) % 100 === 1 ? " " : m; // años consecutivos = temporada
  });
  return / \/ \d{1,4} /.test(sin);
}

// En la DESCRIPCIÓN: "signed by 50 Cent", "firmado por Robert Duvall"… con un nombre propio que no es el personaje.
// Solo cuenta si tras "firmado por / signed by" viene un nombre en mayúsculas (o con cifras): "signed by the legend" no cuenta.
const POR_DESC = /(?:firmad[oa]s?|autografiad[oa]s?|dedicad[oa]s?|signed|autographed|sign[ée]e?|firmat[oa]|autografat[oa]|signiert|assinad[oa])\s+(?:a mano\s+|in person\s+|personally\s+)?(?:por|by|par|da|von)\s+((?:[A-ZÁÉÍÓÚÑÄÖÜ0-9][\w'’.\-]*\s?){1,3})/g;
const NO_NOMBRE = new Set(["el", "la", "los", "las", "the", "le", "il", "lo", "der", "die", "him", "himself", "her", "herself", "me", "mi", "my", "our", "nuestro",
  "propio", "mismo", "jugador", "artista", "actor", "cantante", "player", "artist", "legend", "leyenda", "hand", "mano", "beckett", "psa", "jsa", "bas"]);
export function firmanteEnDescripcion(desc: string, p: Personaje): string | null {
  if (!desc) return null;
  for (const m of desc.matchAll(POR_DESC)) {
    const nombre = m[1].trim();
    const n = normalizar(nombre);
    const primera = n.trim().split(" ")[0];
    if (!primera || NO_NOMBRE.has(primera)) continue;
    if (p.alias.some((a) => n.includes(" " + normalizar(a).trim() + " ") || normalizar(a).includes(n.trim()))) continue;
    return nombre;
  }
  return null;
}

// "Jaafar Jackson Signed … Michael Jackson", "Asher Roth signed … EMINEM": el título EMPIEZA por otro nombre propio
// seguido de la palabra de firma → firma esa persona. Se mira el título original (mayúsculas = nombre propio).
const PALABRA_FIRMA = /\b(signed|autographed|autograph|autogramm|signiert|signiertes|handsigniert|firmad[oa]s?|autografiad[oa]s?|autografat[oa]|sign[ée]e?|assinad[oa])\b/i;
const NO_ES_NOMBRE = new Set(["foto", "photo", "photos", "fotografia", "camiseta", "jersey", "shirt", "poster", "vinyl", "vinilo", "album", "lp", "cd", "dvd",
  "original", "authentic", "autentico", "genuine", "rare", "vintage", "new", "nuevo", "hand", "auto", "autograph", "autografo", "autogramm", "the", "el",
  "la", "los", "das", "der", "die", "framed", "enmarcada", "enmarcado", "official", "oficial", "real", "8x10", "11x14", "16x20", "single", "disco", "libro",
  "book", "programa", "funko", "ticket", "entrada", "card", "carta", "tarjeta", "rarisimo", "raro", "super", "mega", "dual", "triple", "team", "set", "pic",
  "picture", "bild", "image", "imagen", "cuadro", "firma", "autograph", "music", "musica", "rap", "rapper", "king", "of", "pop", "hip", "hop", "itp", "in", "person", "psa", "jsa", "bas", "beckett", "coa",
  "cromo", "cromos", "panini", "topps", "leaf", "futera", "upper", "deck", "prizm", "chrome", "finest", "select", "donruss", "fleer", "hoops", "nba", "nfl",
  "fifa", "uefa", "mundial", "world", "cup", "rookie", "rc", "camisa", "maglia", "trikot", "ball", "balon", "basketball", "football", "lakers", "bulls"]);
export function firmantePrefijo(titulo: string, p: Personaje): string | null {
  const m = titulo.match(PALABRA_FIRMA);
  if (!m || m.index === undefined || m.index === 0) return null;
  const prefijo = titulo.slice(0, m.index).replace(/[-–—:|*•]+\s*$/, "").trim();
  const tokens = prefijo.split(/\s+/).filter((x) => x && !/^[-–—:|*•&+]+$/.test(x));
  if (!tokens.length || tokens.length > 4) return null;
  const pn = normalizar(prefijo);
  if (p.alias.some((a) => pn.includes(" " + normalizar(a).trim() + " "))) return null; // el propio personaje firma
  // Todas las palabras tienen que parecer nombre propio (Mayúscula o cifra) y no ser palabras comunes.
  const nombre = tokens.every((x) => /^[A-ZÁÉÍÓÚÑÄÖÜ0-9]/.test(x) && !NO_ES_NOMBRE.has(normalizar(x).trim()));
  return nombre ? prefijo : null;
}

// "Allen Iverson … vs Kobe Bryant", "Shaq with Kobe", "foto … w Kobe Bryant": el personaje SALE en la pieza, firma otro.
export function personajeComoTema(t: string, p: Personaje): boolean {
  // "with Kobe", "vs Jordan", o posesivo "Quentin Tarantino's Kill Bill" (la película es suya, firma un actor)
  return p.alias.some((a) => new RegExp(` (vs|versus|with|w|con|x|feat|featuring|junto a|mit) ${normalizar(a).trim()} | ${normalizar(a).trim()} s `).test(t));
}

// Varios firmantes que NO son solo el personaje ("Stallone & Talia Shire", "Allen Iverson y Kobe Bryant", "dual signed").
const NOMBRE2 = "[A-ZÁÉÍÓÚÑ][\\w'’.\\-]+\\s+[A-ZÁÉÍÓÚÑ][\\w'’.\\-]+";
export function variosFirmantes(titulo: string, p: Personaje): string | null {
  const t = normalizar(titulo);
  if (/ (dual|triple|team) (signed|autographed|signiert) | firmad[ao] doble | doble firma | dual-signed /.test(t + " ") || /dual-signed|dual signed/i.test(titulo)) return "varias firmas";
  const alias = p.alias.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // Conectores como palabra suelta ("&", "+", "and", "y", "und", "e", "et"), nunca pegados a otra palabra.
  const conectores = "(?:\\s*[&+]|\\s+(?:and|y|und|e|et))";
  const tras = new RegExp(`\\b(?:${alias})${conectores}\\s+(${NOMBRE2})`, "i").exec(titulo);
  const antes = new RegExp(`(${NOMBRE2})${conectores}\\s+(?:${alias})\\b`, "i").exec(titulo);
  for (const m of [tras, antes]) {
    if (!m) continue;
    const otro = m[1];
    const palabras = otro.split(/\s+/);
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(palabras[0]) || !/^[A-ZÁÉÍÓÚÑ]/.test(palabras[1])) continue;
    if (palabras.some((w) => NO_ES_NOMBRE.has(normalizar(w).trim()))) continue;
    if (p.alias.some((a) => normalizar(otro).includes(" " + normalizar(a).trim() + " "))) continue;
    return otro;
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
      const [id, nombre, categoria, alias, noConfundir = ""] = l.split("|").map((x) => x.trim());
      return {
        id, nombre, categoria, alias: alias.split(",").map((a) => a.trim()).filter(Boolean),
        noConfundir: noConfundir.split(",").map((a) => a.trim()).filter(Boolean),
      };
    });
}

// ---------- reconocedor ----------
export function reconocer(titulo: string, personajes: Personaje[], descripcion = ""): Resultado {
  const t = normalizar(titulo);
  const todo = normalizar(titulo + " " + descripcionUtil(descripcion));

  // 1) Personaje: exactamente uno.
  const encontrados = personajes.filter((p) => algun(t, p.alias));
  if (encontrados.length === 0) return { ok: false, motivo: "sin_personaje" };
  const tipoTitulo = TIPOS.find((x) => algun(t, x.frases))?.tipo ?? "otro";
  // Multifirma: varios personajes de CINE en un póster o foto (p. ej. "Heat" firmado por De Niro y Al Pacino).
  // Se trata como una pieza propia ("al-pacino+robert-de-niro") y solo se compara con piezas de los mismos firmantes.
  const multifirma = encontrados.length > 1 && encontrados.every((p) => p.categoria === "cine") && ["poster", "foto"].includes(tipoTitulo);
  if (encontrados.length > 1 && !multifirma)
    return { ok: false, motivo: "ambiguo", detalle: encontrados.map((p) => p.nombre).join(" / ") };
  const orden = [...encontrados].sort((a, b) => a.id.localeCompare(b.id));
  const personaje: Personaje = multifirma
    ? { id: orden.map((p) => p.id).join("+"), nombre: orden.map((p) => p.nombre).join(" + "), categoria: "cine", alias: orden.flatMap((p) => p.alias) }
    : encontrados[0];

  const confusion = (personaje.noConfundir ?? []).find((c) => tiene(t, c));
  if (confusion) return { ok: false, motivo: "firma_otro", detalle: confusion };
  if (!multifirma && personajeComoTema(t, personaje)) return { ok: false, motivo: "firma_otro", detalle: "el personaje sale en la foto, firma otro" };
  const otro = multifirma ? null
    : (firmanteDistinto(t, personaje) ?? firmantePrefijo(titulo, personaje) ?? firmanteEnDescripcion(descripcionUtil(descripcion), personaje));
  if (!otro && !multifirma) {
    const varios = variosFirmantes(titulo, personaje);
    if (varios) return { ok: false, motivo: "varios_firmantes", detalle: varios };
  }
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
    (tipo === "tarjeta" && algun(t, ["autografo", "autografiada", "autografata", "autographed", "signed", "firmada", "firmado"]) && numerada(t));
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
