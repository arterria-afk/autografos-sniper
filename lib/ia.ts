// Segunda opinión con IA (Claude): mira la foto y lee la descripción de cada candidato
// antes de avisarte. Solo se usa si existe ANTHROPIC_API_KEY en Vercel.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./supabase";

export const iaActiva = () => !!process.env.ANTHROPIC_API_KEY;
const MAX_DIA = () => Number(process.env.IA_MAX_DIA ?? 40); // tope de revisiones al día (control de coste)

const Veredicto = z.object({
  firma_a_mano: z.enum(["si", "no", "dudoso"]).describe("¿La firma parece hecha a mano (no impresa, estampada, serigrafiada ni facsímil)?"),
  personaje_correcto: z.enum(["si", "no", "dudoso"]).describe("¿La firma es del personaje indicado (no de otra persona que sale en la pieza)?"),
  certificado: z.enum(["reconocido", "generico", "ninguno", "dudoso"]).describe("Autentificación de la FIRMA: reconocido = PSA/DNA, Beckett/BAS, JSA, Upper Deck Authenticated, Fanatics o autógrafo de fábrica de Panini/Topps/Leaf/Futera; generico = COA de otra empresa o del vendedor"),
  lote_o_replica: z.boolean().describe("¿Es un lote, una réplica, una copia o varias piezas?"),
  riesgo: z.enum(["bajo", "medio", "alto"]).describe("Riesgo global de que no sea lo que parece"),
  motivo: z.string().describe("Una o dos frases en español explicando el veredicto"),
});
export type VeredictoIA = z.infer<typeof Veredicto>;

const SISTEMA = `Eres un experto en autentificación de autógrafos deportivos y musicales que ayuda a un comprador profesional a filtrar anuncios de segunda mano (Vinted, Wallapop, eBay).
Recibes el título, la descripción, el precio y normalmente la foto principal de un anuncio que un filtro automático ya ha marcado como "autógrafo certificado" de un personaje concreto. Tu trabajo es detectar los que NO lo son.

Ten en cuenta:
- Una nota de gradación de la tarjeta ("PSA 9", "BGS 8.5", "Beckett 10") NO autentifica la firma. Solo cuenta si la firma está autentificada (PSA/DNA, "Auto" graduado, pegatina/holograma de JSA o Beckett/BAS, Upper Deck Authenticated, Fanatics) o si es un autógrafo de fábrica de la tarjeta (Panini, Topps, Leaf, Futera: "auto", "on card", sticker auto, numeradas).
- Un cromo firmado a mano con "certificado" del propio vendedor es un COA genérico, no reconocido.
- Firmas impresas, serigrafiadas, bordadas, estampadas, facsímil o "preprint" no son autógrafos.
- Fíjate en quién firma: a veces la pieza muestra a un personaje pero firma otra persona (un compañero, un director, un actor).
- Precios muy bajos para piezas de alto valor (p. ej. una camiseta firmada de Messi con Beckett a 50 €) son una señal de alarma.
- Si no hay foto o no se ve bien, básate en el texto y usa "dudoso" donde no puedas saberlo.
- Responde con prudencia: la duda razonable es "dudoso", no "si".`;

let cliente: Anthropic | null = null;

async function usadasHoy(): Promise<number> {
  const desde = new Date(); desde.setUTCHours(0, 0, 0, 0);
  const { count } = await db().from("deals").select("id", { count: "exact", head: true }).not("ia", "is", null).gte("created_at", desde.toISOString());
  return count ?? 0;
}

export type Candidato = { titulo: string; descripcion?: string | null; precio: number; plataforma: string; personaje: string; certificados: string[]; foto?: string | null; referencia?: number | null };

// Devuelve el veredicto, o null si la IA no está activa, se ha llegado al tope diario o falla (entonces se avisa igual, sin opinión).
export async function revisar(c: Candidato): Promise<VeredictoIA | null> {
  if (!iaActiva()) return null;
  try {
    if ((await usadasHoy()) >= MAX_DIA()) return null;
  } catch { /* sin columna ia (migración 003 pendiente): seguimos sin tope */ }
  cliente ??= new Anthropic();

  const texto = [
    `Personaje que debería firmar: ${c.personaje}`,
    `Plataforma: ${c.plataforma}`,
    `Precio: ${c.precio} €${c.referencia ? ` (referencia de mercado aprox.: ${c.referencia} €)` : ""}`,
    `Certificados detectados por el filtro: ${c.certificados.join(", ") || "ninguno"}`,
    `Título: ${c.titulo}`,
    `Descripción: ${(c.descripcion ?? "").slice(0, 2500) || "(sin descripción)"}`,
  ].join("\n");

  const pedir = (conFoto: boolean) =>
    cliente!.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // si el modelo principal se niega, la API reintenta con otro modelo
      output_config: { effort: "low", format: betaZodOutputFormat(Veredicto) },
      system: SISTEMA,
      messages: [{
        role: "user",
        content: conFoto && c.foto
          ? [{ type: "image", source: { type: "url", url: c.foto } }, { type: "text", text: texto }]
          : [{ type: "text", text: texto }],
      }],
    }, { timeout: 40_000, maxRetries: 1 });

  try {
    let r;
    try { r = await pedir(true); }
    catch (e) {
      // Si la foto no se puede descargar, se revisa solo con el texto.
      if (c.foto && e instanceof Anthropic.BadRequestError) r = await pedir(false);
      else throw e;
    }
    if (r.stop_reason === "refusal") return null;
    return r.parsed_output ?? null;
  } catch (e) {
    console.error("IA:", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : (e as Error).message);
    return null;
  }
}

// ¿Lo descartamos sin avisar? Solo con señales claras; "dudoso" no descarta.
export function descartarPorIA(v: VeredictoIA | null): boolean {
  if (!v) return false;
  return v.riesgo === "alto" || v.firma_a_mano === "no" || v.personaje_correcto === "no" || v.lote_o_replica;
}

const SI = { si: "✔", no: "✘", dudoso: "?" } as const;
export function resumenIA(v: VeredictoIA): string {
  const cert = { reconocido: "✔", generico: "COA genérico", ninguno: "✘", dudoso: "?" }[v.certificado];
  return `🤖 IA: riesgo ${v.riesgo} · firma a mano ${SI[v.firma_a_mano]} · personaje ${SI[v.personaje_correcto]} · certificado ${cert} — ${v.motivo}`;
}
