-- ==================================================================
-- Migración Fase 9 — cuenta de Administrador con control total
--
-- Agrega una tercera cuenta ("Administrador") que ve y escribe los datos de
-- CUALQUIER almacén — piensa en ella como un "OR" que se suma a la regla de
-- cada almacén, no como un mapeo cerrado más. La bandera vive en el
-- `app_metadata` del JWT (igual que `almacen` para las cuentas normales):
-- solo se puede escribir con un UPDATE privilegiado, nunca desde la app.
--
-- OJO — `es_admin()` es un bypass GLOBAL, no atado a "qué almacén está
-- viendo el administrador en el panel": el selector de panel del frontend
-- es una comodidad de navegación (impersonar), no el límite real de
-- permiso — el límite real es la sesión (es admin o no lo es). Es
-- exactamente el "100% de control" pedido, se deja escrito acá para que no
-- se lea como un descuido más adelante.
--
-- Ejecutar DESPUÉS de crear el usuario en Authentication → Users (email
-- corporacion2026@almacen.local, password CORPORACION1980, Auto Confirm
-- User) — el UPDATE del final no hace nada si el usuario todavía no existe.
-- Es idempotente.
-- ==================================================================

create or replace function public.es_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- categories / movements / comprobantes: el admin ve y escribe cualquier almacén.
drop policy if exists "categories_por_almacen" on public.categories;
create policy "categories_por_almacen"
  on public.categories for all
  to authenticated
  using (almacen = public.almacen_actual() or public.es_admin())
  with check (almacen = public.almacen_actual() or public.es_admin());

drop policy if exists "movements_por_almacen" on public.movements;
create policy "movements_por_almacen"
  on public.movements for all
  to authenticated
  using (almacen = public.almacen_actual() or public.es_admin())
  with check (almacen = public.almacen_actual() or public.es_admin());

drop policy if exists "comprobantes_por_almacen" on public.comprobantes;
create policy "comprobantes_por_almacen"
  on public.comprobantes for all
  to authenticated
  using (almacen = public.almacen_actual() or public.es_admin())
  with check (almacen = public.almacen_actual() or public.es_admin());

-- traspasos: el admin ve y actualiza cualquiera. En el insert, el OR va
-- ACOTADO solo a la cláusula de identidad — si fuera al final de toda la
-- cadena "and", por precedencia de operadores en SQL quedaría
-- "(A and B and C and D) or es_admin()", y el admin podría insertar un
-- traspaso saltándose las demás condiciones (estado, campos de recepción
-- vacíos) sin que tengan nada que ver con el almacén.
drop policy if exists "traspasos_select" on public.traspasos;
create policy "traspasos_select"
  on public.traspasos for select
  to authenticated
  using (almacen_origen = public.almacen_actual() or almacen_destino = public.almacen_actual() or public.es_admin());

drop policy if exists "traspasos_insert" on public.traspasos;
create policy "traspasos_insert"
  on public.traspasos for insert
  to authenticated
  with check (
    (almacen_origen = public.almacen_actual() or public.es_admin())
    and estado = 'pendiente'
    and movement_ids_entrada = '{}'
    and items_recibidos is null
  );

drop policy if exists "traspasos_update" on public.traspasos;
create policy "traspasos_update"
  on public.traspasos for update
  to authenticated
  using (almacen_origen = public.almacen_actual() or almacen_destino = public.almacen_actual() or public.es_admin())
  with check (almacen_origen = public.almacen_actual() or almacen_destino = public.almacen_actual() or public.es_admin());

-- El trigger deja pasar al admin sin exigir que sea "el lado" que
-- corresponde — pero las columnas que NO se pueden tocar en cada
-- transición siguen igual de protegidas para todos, admin incluido.
create or replace function public.traspasos_validar_transicion()
returns trigger
language plpgsql
as $$
declare
  yo text := public.almacen_actual();
  admin boolean := public.es_admin();
begin
  if not admin and yo is distinct from old.almacen_origen and yo is distinct from old.almacen_destino then
    raise exception 'No autorizado.';
  end if;
  if old.estado is distinct from 'pendiente' then
    raise exception 'Este traspaso ya no está pendiente.';
  end if;

  if new.estado = 'cancelado' then
    if new.items is distinct from old.items
       or new.numero is distinct from old.numero
       or new.almacen_origen is distinct from old.almacen_origen
       or new.almacen_destino is distinct from old.almacen_destino
       or new.movement_ids_salida is distinct from old.movement_ids_salida
       or new.movement_ids_entrada is distinct from old.movement_ids_entrada
       or new.items_recibidos is distinct from old.items_recibidos then
      raise exception 'Al cancelar solo se puede cambiar el estado y el motivo.';
    end if;
  elsif new.estado = 'recibido' then
    if not admin and yo is distinct from old.almacen_destino then
      raise exception 'Solo el almacén destino puede recibir.';
    end if;
    if new.items is distinct from old.items
       or new.numero is distinct from old.numero
       or new.almacen_origen is distinct from old.almacen_origen
       or new.almacen_destino is distinct from old.almacen_destino
       or new.movement_ids_salida is distinct from old.movement_ids_salida
       or new.motivo_cancelacion is distinct from old.motivo_cancelacion then
      raise exception 'No se pueden modificar los datos de envío.';
    end if;
  else
    raise exception 'Transición de estado no permitida.';
  end if;

  return new;
end;
$$;

-- No se toca storage.objects / bucket "productos": ya es de lectura y
-- escritura abierta a cualquier autenticado, sin scoping por almacén.

-- Asigna el rol. Repetir si se crea el usuario después de correr esto.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'corporacion2026@almacen.local';
