-- ==================================================================
-- Migración Fase 2 — modelo de datos
-- Ejecutar UNA vez en el SQL Editor de Supabase sobre la base actual.
-- Es idempotente: se puede volver a correr sin efecto.
-- ==================================================================

-- 1. Campos nuevos en movements ------------------------------------
alter table public.movements add column if not exists unidad_medida text;
alter table public.movements add column if not exists costo numeric not null default 0;
alter table public.movements add column if not exists precio_venta numeric not null default 0;

-- Rellena el costo unitario a partir del "valor total" histórico
update public.movements
set costo = round(valor / nullif(cantidad, 0), 4)
where costo = 0 and valor > 0 and cantidad > 0;

-- 2. Bucket de imágenes de producto ------------------------------
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists "productos_public_read" on storage.objects;
create policy "productos_public_read"
  on storage.objects for select
  using (bucket_id = 'productos');

drop policy if exists "productos_auth_insert" on storage.objects;
create policy "productos_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'productos');

drop policy if exists "productos_auth_update" on storage.objects;
create policy "productos_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'productos');

drop policy if exists "productos_auth_delete" on storage.objects;
create policy "productos_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'productos');
