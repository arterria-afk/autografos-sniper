"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Panel", icon: "🏠" },
  { href: "/autografos", label: "Autógrafos", icon: "✍️" },
  { href: "/cartas", label: "Cartas", icon: "🃏" },
  { href: "/chollos", label: "Chollos", icon: "🔥" },
  { href: "/negocio", label: "Mi negocio", icon: "💼" },
  { href: "/snipes", label: "Snipes", icon: "🎯" },
  { href: "/valorar", label: "Valorar", icon: "🔎" },
  { href: "/ventas", label: "Ventas", icon: "💰" },
  { href: "/estado", label: "Estado", icon: "⚙️" },
];

export function Nav() {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href) || (href === "/autografos" && ruta.startsWith("/personaje")));
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b0f14]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm text-black">AS</span>
          <span className="hidden sm:inline">Sniper</span>
        </Link>
        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${activo(n.href) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
