import { db } from "./supabase";

export type Voto = "bueno" | "duda" | "mal";
export type Motivo = "no_firma" | "no_personaje" | "precio" | "otro";

export const MOTIVOS: Record<Motivo, string> = {
  no_firma: "No es firma real",
  no_personaje: "No es ese personaje",
  precio: "Precio mal calculado",
  otro: "Otro",
};

// Cuántos ❌ (firma falsa / personaje equivocado) hacen falta para bloquear a un vendedor.
const BLOQUEO_TRAS = 2;

// Guarda el voto y aplica lo "aprendido":
//  ❌ firma/personaje → el anuncio queda descartado (no sale ni cuenta como referencia)
//  y si el vendedor acumula varios, se bloquea (no se vuelven a mostrar sus anuncios).
export async function registrarVoto(dealId: number, fb: Voto, motivo: Motivo | null = null) {
  const { data: deal } = await db().from("deals")
    .update({ fb, fb_motivo: fb === "mal" ? motivo : null, fb_at: new Date().toISOString() })
    .eq("id", dealId).select("listing_id").single();
  if (!deal?.listing_id) return;

  const grave = fb === "mal" && (motivo === "no_firma" || motivo === "no_personaje");
  await db().from("listings").update({ descartado: grave }).eq("id", deal.listing_id);
  if (!grave) return;

  const { data: l } = await db().from("listings").select("platform,seller").eq("id", deal.listing_id).single();
  if (!l?.seller) return;
  const { data: delVendedor } = await db().from("listings").select("id").eq("platform", l.platform).eq("seller", l.seller).eq("descartado", true);
  if ((delVendedor?.length ?? 0) >= BLOQUEO_TRAS)
    await db().from("vendedores_bloqueados").upsert({ platform: l.platform, seller: l.seller, motivo: `${delVendedor!.length} anuncios marcados ❌` });
}

export async function vendedorBloqueado(platform: string, seller: string | null | undefined) {
  if (!seller) return false;
  const { data } = await db().from("vendedores_bloqueados").select("seller").eq("platform", platform).eq("seller", seller).maybeSingle();
  return !!data;
}
