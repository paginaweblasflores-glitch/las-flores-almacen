-- ==================================================================
-- Migración Fase 5 — comprobantes
-- Copia CONGELADA de cada registro de entrada/salida: guarda el número
-- correlativo y la lista de productos tal como se registró (y como se
-- imprimió, en el caso de las salidas). No cambia aunque después se edite
-- o se borre un movimiento.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
-- ==================================================================

create table if not exists public.comprobantes (
  id            text primary key,
  tipo          text not null check (tipo in ('Entrada', 'Salida')),
  numero        integer not null,          -- correlativo dentro del periodo (1, 2, 3…)
  periodo       text not null,             -- año ("2026"); el correlativo reinicia cada año
  fecha         date not null,             -- fecha del movimiento (la que puso el usuario)
  area          text not null,
  responsable   text not null,
  observaciones text,
  items         jsonb not null default '[]'::jsonb,  -- [{codigo, descripcion, cantidad, unidad_medida}]
  movement_ids  text[] not null default '{}',        -- ids de los movements que lo componen
  created_at    timestamptz not null default now(),
  unique (tipo, periodo, numero)
);

create index if not exists comprobantes_created_at_idx on public.comprobantes (created_at);

alter table public.comprobantes enable row level security;

drop policy if exists "comprobantes_public_access" on public.comprobantes;
create policy "comprobantes_public_access"
  on public.comprobantes for all
  to authenticated
  using (true)
  with check (true);
