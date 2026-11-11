-- 003_ia.sql  ·  Pégalo entero en Supabase → SQL Editor → Run.
-- Guarda la segunda opinión de la IA en cada alerta.
alter table deals add column if not exists ia jsonb;                                  -- veredicto completo
alter table deals add column if not exists ia_descartado boolean not null default false; -- la IA lo descartó (no se avisó)
