-- 002_negocio_y_votos.sql  ·  Pégalo entero en Supabase → SQL Editor → Run.

-- Votos de 3 botones: bueno / duda / mal (+ motivo si es "mal").
alter table deals add column if not exists fb text;          -- bueno | duda | mal
alter table deals add column if not exists fb_motivo text;   -- no_firma | no_personaje | precio | otro
alter table deals add column if not exists fb_at timestamptz;

-- Anuncios: vendedor (para bloquear) y descartado (marcado ❌).
alter table listings add column if not exists seller text;
alter table listings add column if not exists descartado boolean not null default false;

-- Vendedores bloqueados (se dejan de mostrar sus anuncios).
create table if not exists vendedores_bloqueados (
  platform   text not null,
  seller     text not null,
  motivo     text,
  created_at timestamptz not null default now(),
  primary key (platform, seller)
);

-- Mi negocio: lo que compro y vendo.
create table if not exists inventario (
  id             bigserial primary key,
  personaje_id   text,
  descripcion    text not null,
  tipo           text,
  certificado    text,             -- PSA/DNA, Beckett… (vacío = sin certificado)
  cert_numero    text,
  foto_path      text,
  comprado_en    text,             -- eBay, Vinted, Wallapop, feria…
  fecha_compra   date not null default current_date,
  precio_compra  numeric(10,2) not null default 0,
  gastos_compra  numeric(10,2) not null default 0,  -- envío, aduana, autenticación
  estado         text not null default 'en_stock',  -- en_stock | vendida
  vendido_en     text,
  fecha_venta    date,
  precio_venta   numeric(10,2),
  gastos_venta   numeric(10,2) not null default 0,  -- comisiones, envío
  notas          text,
  snipe_id       bigint unique references snipes(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table vendedores_bloqueados enable row level security;
alter table inventario enable row level security;
