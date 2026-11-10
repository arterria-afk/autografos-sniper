import { envStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function Estado() {
  const vars = envStatus();
  const faltan = vars.filter((v) => !v.ok).length;
  return (
    <div className="space-y-4">
      <h1 className="text-xl text-[#5cf08a]">Estado de las claves</h1>
      <p className="text-sm text-[#8fa394]">
        {faltan === 0
          ? "Todo configurado."
          : `Faltan ${faltan} claves. Se añaden en Vercel → Settings → Environment Variables y después hay que hacer «Redeploy».`}
      </p>
      <ul className="rounded border border-[#1f2a22] bg-[#0f1411] divide-y divide-[#1f2a22] text-sm">
        {vars.map((v) => (
          <li key={v.name} className="px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span>
              <span className={v.ok ? "text-[#5cf08a]" : "text-[#f06b5c]"}>{v.ok ? "✔" : "✘"}</span>{" "}
              <code className="break-all">{v.name}</code>
            </span>
            <span className="text-[#5f7364] text-xs">{v.desc} · fase {v.fase}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
