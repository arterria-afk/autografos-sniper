// Conexión con la API de Gixen (solo funciona con suscripción a Gixen Mirror).
// Protocolo: https://www.gixen.com/api.php?username=…&password=…&notags=1&<acción>
// Usuario y contraseña SOLO en variables de entorno de Vercel (GIXEN_USER / GIXEN_PASS).

const URL_API = "https://www.gixen.com/api.php";

export const gixenActivo = () => !!(process.env.GIXEN_USER && process.env.GIXEN_PASS);

export class GixenError extends Error {
  codigo: number;
  constructor(codigo: number, texto: string) { super(texto); this.codigo = codigo; }
}

const ERRORES: Record<number, string> = {
  101: "Usuario o contraseña de Gixen incorrectos.",
  171: "Gixen no reconoce el acceso: entra una vez en gixen.com con tu cuenta desde el navegador y revisa GIXEN_USER y GIXEN_PASS en Vercel.",
};
export const mensajeError = (e: unknown) =>
  e instanceof GixenError ? `Gixen dice: ${ERRORES[e.codigo] ?? e.message} (código ${e.codigo})` : `No se pudo hablar con Gixen: ${(e as Error).message}`;

async function llamar(params: Record<string, string | number>): Promise<string> {
  const u = new URL(URL_API);
  u.search = new URLSearchParams({ username: process.env.GIXEN_USER!, password: process.env.GIXEN_PASS!, notags: "1", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) }).toString();
  const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  const body = (await r.text()).trim();
  const m = body.match(/^ERROR \((\d+)\): (.*)$/m);
  if (m) throw new GixenError(Number(m[1]), m[2]);
  return body;
}

export type SnipeGixen = { itemid: string; fin: Date | null; maxbid: number; estado: string; mensaje: string; titulo: string; servidor: "principal" | "mirror" };

const ESTADOS: Record<string, string> = { N: "programado", S: "saltado", D: "terminado" };

// Una línea: "<br />|#!#|itemid|#!#|endtime|#!#|maxbid|#!#|status|#!#|message|#!#|title|#!#|group|#!#|qty|#!#|offset"
export function parsearListado(body: string, servidor: SnipeGixen["servidor"]): SnipeGixen[] {
  return body.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l.includes("|#!#|") && !/OK M(AIN|IRROR) LISTED/.test(l))
    .map((l) => {
      const c = l.split("|#!#|");
      const fin = Number(c[2]);
      return {
        itemid: c[1], fin: fin ? new Date(fin * 1000) : null, maxbid: Number(c[3]),
        estado: ESTADOS[c[4]] ?? c[4], mensaje: c[5] ?? "", titulo: c[6] ?? "", servidor,
      };
    })
    .filter((s) => /^\d+$/.test(s.itemid));
}

// Programa un snipe. bidoffset = segundos antes del final (3, 6, 8, 10 o 15).
export async function programar(itemid: string, puja: number, bidoffset = 6) {
  const body = await llamar({ itemid, maxbid: puja.toFixed(2), bidoffset, bidoffsetmirror: bidoffset });
  if (!new RegExp(`^OK ${itemid} ADDED`, "m").test(body)) throw new Error(`respuesta inesperada: ${body.slice(0, 120)}`);
}

export async function quitar(itemid: string) {
  const body = await llamar({ ditemid: itemid });
  if (!new RegExp(`^OK ${itemid} DELETED`, "m").test(body)) throw new Error(`respuesta inesperada: ${body.slice(0, 120)}`);
}

// Lista los snipes de los dos servidores (si un item está en ambos, se queda el del principal).
export async function listar(): Promise<SnipeGixen[]> {
  const [main, mirror] = await Promise.all([llamar({ listsnipesmain: 1 }), llamar({ listsnipesmirror: 1 })]);
  const out = new Map<string, SnipeGixen>();
  for (const s of [...parsearListado(mirror, "mirror"), ...parsearListado(main, "principal")]) out.set(s.itemid, s);
  return [...out.values()].sort((a, b) => (a.fin?.getTime() ?? 0) - (b.fin?.getTime() ?? 0));
}
