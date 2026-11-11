import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluye el catálogo de personajes en las funciones del servidor de Vercel.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
  serverExternalPackages: ["sharp"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
