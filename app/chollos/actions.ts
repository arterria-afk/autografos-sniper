"use server";
import { revalidatePath } from "next/cache";
import { registrarVoto, type Motivo, type Voto } from "@/lib/votos";

export async function votar(form: FormData) {
  const id = Number(form.get("id"));
  const fb = String(form.get("fb")) as Voto;
  const motivo = (String(form.get("motivo") ?? "") || null) as Motivo | null;
  if (!id || !["bueno", "duda", "mal"].includes(fb)) return;
  if (fb === "mal" && !motivo) return; // hay que elegir el porqué
  await registrarVoto(id, fb, motivo);
  revalidatePath("/chollos");
  revalidatePath("/");
}
