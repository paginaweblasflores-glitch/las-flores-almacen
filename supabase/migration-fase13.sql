-- Catálogo de productos único y compartido entre almacenes. La identidad
-- del producto (código, descripción, unidad, categoría, imagen) deja de ser
-- independiente por almacén; el stock/costo/stock mínimo sigue siendo 100%
-- de cada almacén (movements no cambia su alcance ni su RLS).
create table if not exists public.productos (
  codigo            text primary key,
  descripcion       text not null,
  unidad_medida     text,
  categoria         text,
  imagen            text,
  creado_en_almacen text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.productos enable row level security;

-- A diferencia de movements/comprobantes/categories, acá NO se filtra por
-- almacen_actual(): el catálogo es la misma tabla para todas las cuentas
-- (cualquier almacenero o el admin lo ve y lo da de alta/edita). Sin
-- política de "for delete" a propósito: nadie borra un producto del
-- catálogo compartido desde la app.
drop policy if exists "productos_select" on public.productos;
create policy "productos_select"
  on public.productos for select
  to authenticated
  using (true);

drop policy if exists "productos_insert" on public.productos;
create policy "productos_insert"
  on public.productos for insert
  to authenticated
  with check (true);

drop policy if exists "productos_update" on public.productos;
create policy "productos_update"
  on public.productos for update
  to authenticated
  using (true)
  with check (true);

-- Seed: el catálogo nace del inventario actual (snapshot más reciente por
-- código). Sin filtrar por almacen a propósito — Umaru ya está vacío
-- (migration-fase12.sql) así que en la práctica solo hay filas de Las
-- Flores, pero así también se cubren movimientos viejos que hayan quedado
-- con el valor de almacen anterior al rename a "restaurante-las-flores"
-- (por eso la FK de abajo fallaba: código "330" existía en movements con
-- un almacen que el filtro anterior no capturaba).
insert into public.productos (codigo, descripcion, unidad_medida, categoria, imagen, creado_en_almacen)
select distinct on (upper(trim(codigo)))
  upper(trim(codigo)), descripcion, unidad_medida, categoria, imagen, almacen
from public.movements
order by upper(trim(codigo)), created_at desc
on conflict (codigo) do nothing;

-- A partir de ahora, todo movimiento tiene que referenciar un código que ya
-- exista en el catálogo compartido (en cualquier almacén). Normalizamos
-- movements.codigo a MAYÚSCULAS/trim primero para que coincida con la PK.
update public.movements set codigo = upper(trim(codigo)) where codigo <> upper(trim(codigo));

alter table public.movements drop constraint if exists movements_codigo_fkey;
alter table public.movements
  add constraint movements_codigo_fkey
  foreign key (codigo) references public.productos (codigo)
  on update cascade;
