// Solo construye la URL pública (se puede usar en páginas, sin sharp).
export function fotoPublica(path: string | null | undefined, original?: string | null): string | null {
  if (path) return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos/${path}`;
  return original ?? null;
}
