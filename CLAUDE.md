# Sniper de autógrafos y cartas — notas para Claude

Proyecto de un compraventa de autógrafos (usuario NO programador, habla en español: responder en español,
pasos concretos y numerados, nunca pedirle que pegue claves en el chat). Basado en el plano de un amigo
(cartas Topps/Panini en Vinted), adaptado a autógrafos + cartas.

## Qué hace
1. Busca anuncios automáticamente (GitHub Actions → rutas `/api/*` de la web en Vercel → Supabase):
   - Vinted (lee la página de resultados HTML; su API interna ya no existe) cada 15 min. Lee la DESCRIPCIÓN de cada anuncio nuevo antes de alertar (`/api/descripcion`).
   - Wallapop (API interna `api.wallapop.com/api/v3/search`, SIN `order_by=newest`, que rompe el filtro) cada 15 min.
   - eBay (Browse API oficial, claves en Vercel): anuncios nuevos cada 8 h y SUBASTAS que terminan en ≤3 h cada 3 h, en EBAY_ES/DE/GB/US con palabras en el idioma de cada mercado.
   - Todocoleccion: bloqueado por Cloudflare (no saltarlo). Catawiki: su API no da precios finales (aparcado).
2. Reconoce cada anuncio (separados, el usuario NO quiere mezclarlos):
   - ✍️ Autógrafos de memorabilia: `lib/recognize.ts` (personajes en `data/personajes.txt`). Solo interesan con certificado reconocido (PSA/DNA, Beckett/BAS, JSA, Upper Deck Authenticated, Fanatics, autógrafo de fábrica Panini/Topps/Leaf/Futera en tarjetas). "PSA 9" = nota de tarjeta, NO autentica firma. Multifirma de cine (póster/foto) permitida: id `a+b`.
   - 🃏 Cartas: `lib/cartas.ts` (jugadores en `data/jugadores.txt`): carta exacta (`carta_clave` = jugador|colección|temporada|paralela|/num|nota|auto). Solo con valor (numeradas, graduadas o auto), ≥ 25 €. Camisetas/fotos/balones/pósters NUNCA son cartas.
   - Bancos de pruebas: `npm run probar` (autógrafos) y `npm run probar-cartas`. Regla: 0 fallos tras cada cambio.
3. Registra VENTAS REALES: Vinted (`vinted-sold`), Wallapop (solo si lo marca vendido), eBay (`/api/ebay-sold`: subasta terminada con unidades vendidas = venta), y las ventas propias de "Mi negocio" (Excel importado).
4. Chollos a Telegram SOLO comparando con ventas reales (decisión del usuario: "una cosa es que lo ofrezcan y otra que lo vendan"). ≥2 ventas de lo mismo → mediana; ≥25 % por debajo. Los precios pedidos por otros vendedores son solo "💡 Oportunidades" (resumen y web), nunca alerta.
5. Resúmenes por Telegram a las 10:00 y 17:00 (Europe/Madrid). Votos ✅ 🤔 ❌ (aprende: descarta, bloquea vendedores).

## Infraestructura
- GitHub: `arterria-afk/autografos-sniper` (público). Ramas auxiliares `diagnostico` y `consulta`: un push lanza un workflow cuyos resultados se leen como *annotations* por la API pública (así se depura sin acceso a Vercel/Supabase).
- Vercel: https://autografos-sniper.vercel.app (contraseña de entrada = `APP_PASSWORD` o `ALERT_SECRET`).
- Supabase: migraciones `supabase/migrations/001..005` (todas aplicadas a 18-11-2026). El usuario las ejecuta a mano en el SQL Editor (o con la extensión Claude en Chrome).
- Variables Vercel: Supabase (3), TELEGRAM_BOT_TOKEN/CHAT_ID, ALERT_SECRET, EBAY_CLIENT_ID/SECRET (OAuth habilitado y exención de borrado concedida). Opcionales: APP_PASSWORD, GIXEN_USER/PASS (requiere Gixen Mirror, no contratado), ANTHROPIC_API_KEY (IA, no activada), CARTAS_MIN, CHOLLO_SOLO_VENTAS.
- GitHub: secret `ALERT_SECRET`, variable `SITE_URL`.
- Cupo eBay ~5.000 llamadas/día: nuevos 918 + terminan 2.448 + ventas 1.440 ≈ 4.800. Cuidar al añadir búsquedas.
- `/api/health` (claves y migraciones), `/api/stats` (estadísticas), `/api/buscar` (búsqueda interna), `/api/recheck` (re-evaluar todo lo guardado tras cambiar reconocedores).

## Pendiente / ideas
- Limpieza automática de Supabase (500 MB gratis; entran ~7.000 anuncios/día): borrar no vendidos sin ver en 30–45 días. Propuesta al usuario, sin confirmar.
- Vigilar consumo de Vercel Hobby (≈25.000 llamadas/día).
- Comparar cartas aunque falte la temporada (numeradas/graduadas de colección concreta) si siguen faltando referencias.
- Pedir a eBay más cupo (Application Growth Check) o la Marketplace Insights API (ventas 90 días, restringida).
- Arte (obra gráfica firmada) como apartado aparte; Todocoleccion vía alertas por email; IA (Claude) solo para chollos.
