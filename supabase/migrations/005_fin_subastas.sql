-- 005_fin_subastas.sql  ·  Pégalo entero en Supabase → SQL Editor → Run.
-- Fecha de fin de cada anuncio de eBay (sobre todo subastas): sirve para revisar el resultado justo al terminar
-- y registrar como VENTA REAL las que acaban con pujas.
alter table listings add column if not exists ends_at timestamptz;
create index if not exists listings_fin_idx on listings (platform, status, ends_at);
