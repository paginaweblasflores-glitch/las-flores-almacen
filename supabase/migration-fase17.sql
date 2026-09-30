-- Código local independiente por almacén + catálogo maestro compartido.
--
-- Hasta ahora `productos.codigo` cumplía dos roles a la vez: era la
-- identidad compartida del producto Y el código que cada almacén ve/
-- imprime/busca. Eso significaba que el correlativo de códigos era GLOBAL
-- (nextCodigo() escaneaba TODO productos): si Las Flores llegó a 331,
-- Umaru nunca podía empezar en 1 — y si Umaru daba de alta un producto que
-- Las Flores ya tenía con otro nombre/código, quedaban dos filas del mismo
-- producto real sin relación entre sí (el traspaso ya no sería automático).
--
-- Esta migración separa esos dos roles: `productos.id` (uuid) pasa a ser
-- la identidad real, compartida, invisible para el usuario. El código que
-- cada almacén ve es ahora una fila en la nueva tabla `producto_codigos`,
-- independiente por almacén (empieza en 1 en cada uno).

-- 1. Identidad real: productos gana un id propio.
alter table public.productos add column if not exists id uuid not null default gen_random_uuid();

-- 2. Hay que soltar la FK vieja de movements ANTES de tocar la PK de
-- productos (movements_codigo_fkey depende del índice de productos_pkey).
alter table public.movements drop constraint if exists movements_codigo_fkey;

alter table public.productos drop constraint if exists productos_pkey;
alter table public.productos add constraint productos_id_key unique (id);

-- 3. Código local por almacén — vincula almacén + código con la identidad
-- compartida. Un producto tiene como máximo un código por almacén.
create table if not exists public.producto_codigos (
  almacen      text not null,
  producto_id  uuid not null references public.productos (id) on delete cascade,
  codigo       text not null,
  created_at   timestamptz not null default now(),
  primary key (almacen, codigo),
  unique (almacen, producto_id)
);

alter table public.producto_codigos enable row level security;

drop policy if exists "producto_codigos_select" on public.producto_codigos;
create policy "producto_codigos_select"
  on public.producto_codigos for select
  to authenticated
  using (true);

drop policy if exists "producto_codigos_insert" on public.producto_codigos;
create policy "producto_codigos_insert"
  on public.producto_codigos for insert
  to authenticated
  with check (almacen = public.almacen_actual() or public.es_admin());

drop policy if exists "producto_codigos_update" on public.producto_codigos;
create policy "producto_codigos_update"
  on public.producto_codigos for update
  to authenticated
  using (almacen = public.almacen_actual() or public.es_admin())
  with check (almacen = public.almacen_actual() or public.es_admin());

drop policy if exists "producto_codigos_delete" on public.producto_codigos;
create policy "producto_codigos_delete"
  on public.producto_codigos for delete
  to authenticated
  using (almacen = public.almacen_actual() or public.es_admin());

-- 4. Backfill: un código local por cada (almacén, código) que YA aparece
-- en movements — no se renumera nada, cada uno conserva su código actual.
-- Se arma desde movements (no desde productos.creado_en_almacen) porque
-- la FK vieja (ya borrada en el paso 2) garantizó durante toda la vida de
-- la tabla que todo movements.codigo existe en productos.codigo — así el
-- backfill queda completo sin depender de que creado_en_almacen esté
-- siempre bien (hubo al menos un caso manual con ese valor incorrecto).
-- Como Umaru está vacío hoy, en la práctica esto solo crea filas para Las
-- Flores. `productos.codigo` todavía existe en este punto (se borra en el
-- paso 6).
insert into public.producto_codigos (almacen, producto_id, codigo)
select distinct m.almacen, p.id, m.codigo
from public.movements m
join public.productos p on p.codigo = m.codigo
on conflict (almacen, codigo) do nothing;

-- 5. La FK de movements pasa a apuntar al código LOCAL del almacén (no al
-- código global de productos). Efecto importante: renombrar un código
-- ahora cascadea solo a los movimientos de ESE almacén — antes, con la FK
-- vieja sobre productos.codigo, un rename cascadeaba también al código de
-- los movimientos del otro almacén sin que nadie se lo pidiera.
alter table public.movements
  add constraint movements_codigo_almacen_fkey
  foreign key (almacen, codigo) references public.producto_codigos (almacen, codigo)
  on update cascade;

-- 6. El código deja de vivir en productos — la identidad es el id.
alter table public.productos drop column if exists codigo;
alter table public.productos add constraint productos_pkey primary key (id);
