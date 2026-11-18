# Valora una lista de cartas consultando /api/ebay-precio. Uso: python3 valorar-cartas.py  (SITE_URL, ALERT_SECRET)
import json, os, statistics, urllib.parse, urllib.request
SITE, SECRET = os.environ["SITE_URL"].rstrip("/"), os.environ["ALERT_SECRET"]
CARTAS = [
  ("Barcola Finest UCL Auto RC", "Bradley Barcola Finest auto", ["barcola", "finest", "auto"], ["/", "psa", "bgs", "lot"]),
  ("Eric García Chrome UCL 20/21 Auto /50", "Eric Garcia Topps Chrome auto", ["garcia", "chrome", "auto", "/50"], ["lot"]),
  ("Barcola Topps Auto /99", "Bradley Barcola auto /99", ["barcola", "auto", "/99"], ["psa", "lot"]),
  ("Lennart Karl Total Football /75", "Lennart Karl Total Football /75", ["karl", "total football", "/75"], ["psa", "lot", "auto"]),
  ("Max Dowman Total Football /99", "Max Dowman Total Football /99", ["dowman", "total football", "/99"], ["psa", "lot", "auto"]),
  ("Lennart Karl Chrome UCL /299", "Lennart Karl Topps Chrome /299", ["karl", "chrome", "/299"], ["psa", "lot", "auto"]),
  ("Max Dowman Topps Premier League /50", "Max Dowman Topps Premier League /50", ["dowman", "/50"], ["psa", "lot", "auto", "chrome", "finest", "gold"]),
  ("Max Dowman Chrome UCL Aqua /299", "Max Dowman Topps Chrome /299", ["dowman", "chrome", "/299"], ["psa", "lot", "auto"]),
  ("Zico 1978 Panini Argentina 78 PSA 8", "Zico 1978 Panini PSA 8", ["zico", "1978", "psa 8"], ["lot"]),
  ("Fermín López Finest Green Lava PSA 10", "Fermin Lopez Finest Green Lava PSA 10", ["fermin", "finest", "lava", "psa 10"], ["lot"]),
]
def aviso(t, s): print(f"::notice title={t}::{s.replace(chr(10),' ').replace('%','')[:3800]}")
for nombre, q, deben, excluir in CARTAS:
    url = f"{SITE}/api/ebay-precio?q={urllib.parse.quote(q)}"
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"x-alert-secret": SECRET}), timeout=60))
    except Exception as e:
        aviso(nombre, f"ERROR {e}"); continue
    ok = []
    for it in d.get("items", []):
        t = " " + it["titulo"].lower().replace("-", " ") + " "
        if all(w in t for w in deben) and not any(w in t for w in excluir): ok.append(it)
    fijos = sorted(x["eur"] for x in ok if x["tipo"] == "fijo")
    subs = sorted((x for x in ok if x["tipo"] == "subasta"), key=lambda x: x["eur"])
    res = f"precio fijo: n={len(fijos)}"
    if fijos: res += f" min={fijos[0]} mediana={round(statistics.median(fijos))} max={fijos[-1]}"
    res += f" · subastas: {len(subs)} " + ", ".join(f"{x['eur']}€ ({x['pujas']} pujas, fin {(x['fin'] or '')[:10]})" for x in subs[:4])
    ej = sorted(ok, key=lambda x: x["eur"])[:5]
    res += " · ejemplos: " + " | ".join(f"{x['eur']}€ {x['tipo']} {x['titulo'][:70]} https://www.ebay.com/itm/{x['id']}" for x in ej)
    aviso(nombre, res)
