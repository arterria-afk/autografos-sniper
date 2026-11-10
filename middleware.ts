import { NextResponse, type NextRequest } from "next/server";

// Toda la web pide contraseña (APP_PASSWORD, o ALERT_SECRET si no la has puesto).
// Las rutas /api tienen su propia protección (cabecera secreta).
async function token(pass: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("web:" + pass));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const pass = process.env.APP_PASSWORD || process.env.ALERT_SECRET;
  if (!pass) return NextResponse.next(); // aún sin configurar
  if (req.cookies.get("sesion")?.value === (await token(pass))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!api|login|_next|favicon.ico).*)"] };
