import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";

async function entrar(form: FormData) {
  "use server";
  const pass = process.env.APP_PASSWORD || process.env.ALERT_SECRET || "";
  if (String(form.get("pass") ?? "") !== pass) redirect("/login?e=1");
  const v = createHash("sha256").update("web:" + pass).digest("hex");
  (await cookies()).set("sesion", v, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 90 * 86400, path: "/" });
  redirect("/");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <form action={entrar} className="mx-auto mt-12 max-w-sm space-y-3">
      <h1 className="text-[#5cf08a]">&gt; acceso</h1>
      <input name="pass" type="password" autoFocus placeholder="Contraseña" className="w-full rounded border border-[#1f2a22] bg-[#0f1411] px-3 py-2" />
      {e && <p className="text-sm text-[#f06b5c]">Contraseña incorrecta.</p>}
      <button className="w-full rounded bg-[#5cf08a] py-2 font-bold text-black">Entrar</button>
    </form>
  );
}
