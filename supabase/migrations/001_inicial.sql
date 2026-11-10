-- 001_inicial.sql  ·  Pégalo entero en Supabase → SQL Editor → Run.

-- Todos los anuncios vistos (Vinted, eBay…) que el reconocedor ha identificado.
create table if not exists listings (
  id               bigserial primary key,
  external_id      text not null unique,          -- p. ej. vinted:123456
  platform         text not null,                 -- vinted | ebay | wallapop
  market           text,                          -- ES, DE, US…
  title            text not null,
  price            numeric(10,2),
  currency         text default 'EUR',
  url              text,
  photo_url        text,                          -- foto original del anuncio
  photo_path       text,                          -- copia en Storage (bucket fotos)
  personaje_id     text not null,
  tipo             text,
  tamano           text,
  certificados     text[] not null default '{}',
  con_certificado  boolean not null default false,
  coa_generico     boolean not null default false,
  status           text not null default 'activo', -- activo | vendido | borrado | reservado
  seen_at          timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  checked_at       timestamptz,
  sold_at          timestamptz
);
create index if not exists listings_ref_idx on listings (personaje_id, tipo, con_certificado, status);
create index if not exists listings_check_idx on listings (platform, status, checked_at);

-- Alertas enviadas (chollos y novedades certificadas) + votos de Telegram.
create table if not exists deals (
  id               bigserial primary key,
  listing_id       bigint references listings(id) on delete cascade,
  external_id      text not null unique,
  price            numeric(10,2),
  ref_price        numeric(10,2),
  ref_source       text,          -- vinted_sold | ebay | null (sin referencia)
  ref_level        int,           -- 1 = mismo tipo, 2 = parecido
  ref_sample       int,
  ref_comps        jsonb,         -- copia de los comparables
  descuento        numeric(5,2),  -- % por debajo de la referencia
  es_chollo        boolean not null default false,
  photo_url        text,
  telegram_msg_id  bigint,
  fb_obj           text,          -- si | otro | lote
  fb_ref           text,          -- ok | inflada | baja | sin_ventas
  feedback_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- Snipes (Gixen manual).
create table if not exists snipes (
  id            bigserial primary key,
  ebay_item_id  text not null,
  title         text,
  url           text,
  photo_url     text,
  ends_at       timestamptz,
  max_bid       numeric(10,2) not null,
  currency      text default 'EUR',
  notas         text,
  estado        text not null default 'pendiente', -- pendiente | ganada | perdida
  precio_pagado numeric(10,2),
  en_gixen      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Seguridad: nadie puede leer ni escribir desde el navegador.
-- Solo la web (con la clave secreta, en el servidor) accede a los datos.
alter table listings enable row level security;
alter table deals    enable row level security;
alter table snipes   enable row level security;

-- Bucket público para las fotos (miniaturas).
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;
