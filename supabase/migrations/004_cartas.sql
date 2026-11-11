-- 004_cartas.sql  ·  Pégalo entero en Supabase → SQL Editor → Run.
-- Cartas de fútbol: cada anuncio guarda la "carta exacta" para comparar precios solo con la misma carta.
alter table listings add column if not exists kind text not null default 'autografo'; -- autografo | carta
alter table listings add column if not exists carta_clave text;    -- jugador|colección|temporada|paralela|/num|nota|auto
alter table listings add column if not exists carta_desc text;     -- descripción legible
alter table listings add column if not exists carta_grado text;    -- PSA 10, BGS 9.5… (null = sin graduar)
alter table listings add column if not exists carta_numerada int;  -- 50 para /50, 1 para 1/1
alter table listings add column if not exists carta_auto boolean not null default false;
create index if not exists listings_carta_idx on listings (carta_clave, status);
