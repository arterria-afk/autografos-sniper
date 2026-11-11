"use client";
import { useState } from "react";

// Reduce la foto en el móvil (máx. 1000 px, JPEG) antes de enviarla.
export function FotoInput() {
  const [dato, setDato] = useState("");
  const [vista, setVista] = useState("");
  async function cambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.8);
    setDato(url); setVista(url);
  }
  return (
    <label className="flex items-center gap-3 text-xs text-[#8fa394]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {vista ? <img src={vista} alt="" className="h-12 w-12 rounded object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#1f2a22]">📷</span>}
      <span>Foto (opcional)</span>
      <input type="file" accept="image/*" onChange={cambiar} className="hidden" />
      <input type="hidden" name="foto" value={dato} />
    </label>
  );
}
