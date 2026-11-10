import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sniper de Autógrafos",
  description: "Alertas, valoración y snipes de autógrafos certificados",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0d0b" };

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/estado", label: "Estado" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#0a0d0b] text-[#d7e3d9] font-mono antialiased">
        <header className="border-b border-[#1f2a22] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="text-[#5cf08a] font-bold tracking-tight">
            &gt; sniper_autógrafos<span className="animate-pulse">_</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-[#8fa394] hover:text-[#5cf08a]">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
