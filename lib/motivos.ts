// Etiquetas de los votos (sin dependencias: se usan también en el navegador).
// Autógrafos: se valora el ANUNCIO (firma, certificado, personaje), nunca el precio (eso lo calcula el robot).
export const MOTIVOS_MAL_AUTO = {
  no_firma: "Firma falsa o copia",
  no_personaje: "No es ese personaje",
  no_cert: "El certificado no vale",
  otro: "Otro",
} as const;
export const MOTIVOS_DUDA = {
  duda_real: "¿Firma auténtica?",
  duda_cert: "¿Certificado válido?",
  duda_otro: "Otra duda",
} as const;
// Cartas: lo que importa es que el robot haya reconocido bien la carta (si no, compara con otra).
export const MOTIVOS_CARTA = {
  no_carta: "No es esa carta",
  no_interesa: "No me interesa",
} as const;

export type Motivo = keyof typeof MOTIVOS_MAL_AUTO | keyof typeof MOTIVOS_DUDA | keyof typeof MOTIVOS_CARTA;
export type MotivoDuda = keyof typeof MOTIVOS_DUDA;

// Todas las etiquetas (incluidas las antiguas, para votos ya guardados).
export const MOTIVOS: Record<string, string> = {
  ...MOTIVOS_MAL_AUTO, ...MOTIVOS_DUDA, ...MOTIVOS_CARTA,
  precio: "Precio mal calculado", duda_precio: "¿Precio de mercado bien?", depende_precio: "Me interesa según precio",
};
