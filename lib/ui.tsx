import Link from "next/link";

export const eur = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;

export const fecha = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : "—";

export function Caja({ titulo, children, extra }: { titulo?: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded border border-[#1f2a22] bg-[#0f1411]">
      {titulo && (
        <h2 className="flex items-center justify-between border-b border-[#1f2a22] px-4 py-2 text-sm text-[#8fa394]">
          <span>{titulo}</span>
          {extra}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Foto({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <div className="h-16 w-16 shrink-0 rounded bg-[#1f2a22]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className="h-16 w-16 shrink-0 rounded object-cover" />;
}

export function Cert({ certs, coa }: { certs: string[]; coa?: boolean }) {
  if (certs?.length) return <span className="text-[#5cf08a]">✔ {certs.join(", ")}</span>;
  return <span className="text-[#f06b5c]">✘ {coa ? "COA genérico" : "sin certificado"}</span>;
}

export const Enlace = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-[#5cf08a] underline-offset-4 hover:underline">{children}</Link>
);

export function SinDatos({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-[#5f7364]">{children}</p>;
}

export const input = "w-full rounded border border-[#1f2a22] bg-[#0a0d0b] px-3 py-2 text-sm";
export const boton = "rounded bg-[#5cf08a] px-4 py-2 text-sm font-bold text-black";
