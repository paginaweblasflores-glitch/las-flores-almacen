-- ==================================================================
-- Migración Fase 6 — separa los datos por almacén (multi-cuenta)
-- Cada cuenta de acceso (ver CUENTAS en src/supabaseClient.ts) pasa a tener
-- su propio inventario, movimientos, comprobantes y categorías: aislados
-- de verdad con Row Level Security, no solo con un filtro en la app.
--
-- El almacén de cada sesión se lee del token de acceso (app_metadata del
-- usuario en Supabase Auth), no se escribe el correo a mano en cada
-- política. Agregar una cuenta nueva a futuro NO toca las políticas: solo
-- hace falta el UPDATE del paso 4 para esa cuenta.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
-- ==================================================================

-- 1. Columna "almacen" en las tres tablas -----------------------------
-- Todo lo que ya existe hoy es de Las Flores (default 'las-flores'), así
-- que los datos actuales quedan intactos y visibles para esa cuenta.
alter table public.movements add column if not exists almacen text not null default 'las-flores';
alter table public.comprobantes add column if not exists almacen text not null default 'las-flores';
alter table public.categories add column if not exists almacen text not null default 'las-flores';

create index if not exists movements_almacen_idx on public.movements (almacen);
create index if not exists comprobantes_almacen_idx on public.comprobantes (almacen);

-- El nombre de categoría ya no es único global: es único POR almacén.
alter table public.categories drop constraint if exists categories_name_key;
create unique index if not exists categories_almacen_name_idx on public.categories (almacen, name);

-- 2. Categorías por defecto para Hotel Umaru --------------------------
insert into public.categories (name, almacen)
values
  ('Atención y servicio', 'hotel-umaru'),
  ('Empaques y descartables', 'hotel-umaru'),
  ('Mantenimiento', 'hotel-umaru'),
  ('Tecnología y equipos', 'hotel-umaru'),
  ('Seguridad', 'hotel-umaru')
on conflict (almacen, name) do nothing;

-- 3. Función: el almacén del usuario que está haciendo la consulta -----
-- Lo saca del JWT (app_metadata), no de una tabla ni de un valor fijo.
create or replace function public.almacen_actual()
returns text
language sql
stable
as $$
  select nullif(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'almacen'),
    ''
  );
$$;

-- 4. Le asigna su almacén a cada cuenta que ya existe ------------------
-- Correr una vez por cada cuenta. Al agregar una cuenta nueva en el
-- futuro, esta es la única línea nueva que hace falta (además de crear el
-- usuario y sumarlo a CUENTAS en el frontend) — las políticas de abajo no
-- se tocan.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('almacen', 'las-flores')
where email = 'almacen2026@almacen.local';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('almacen', 'hotel-umaru')
where email = 'almacenumaru2026@almacen.local';

-- 5. RLS: cada cuenta solo ve y escribe las filas de SU almacén --------
drop policy if exists "movements_public_access" on public.movements;
drop policy if exists "movements_por_almacen" on public.movements;
create policy "movements_por_almacen"
  on public.movements for all
  to authenticated
  using (almacen = public.almacen_actual())
  with check (almacen = public.almacen_actual());

drop policy if exists "comprobantes_public_access" on public.comprobantes;
drop policy if exists "comprobantes_por_almacen" on public.comprobantes;
create policy "comprobantes_por_almacen"
  on public.comprobantes for all
  to authenticated
  using (almacen = public.almacen_actual())
  with check (almacen = public.almacen_actual());

drop policy if exists "categories_public_access" on public.categories;
drop policy if exists "categories_por_almacen" on public.categories;
create policy "categories_por_almacen"
  on public.categories for all
  to authenticated
  using (almacen = public.almacen_actual())
  with check (almacen = public.almacen_actual());

-- ==================================================================
-- IMPORTANTE: después de correr esto, hay que CERRAR SESIÓN Y VOLVER A
-- ENTRAR con cada cuenta. El token de sesión que ya está abierto en el
-- navegador no tiene el "almacen" nuevo adentro — recién lo tiene el
-- token que se genera en el próximo login.
-- ==================================================================
