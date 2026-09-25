-- ==================================================================
-- Migración Fase 11 — recibir un traspaso línea por línea
--
-- Hasta ahora recibir un traspaso era todo o nada. TumiSoft (referencia
-- que pasó el cliente) deja aceptar producto por producto: lo que no se
-- marca se rechaza solo, sin tocar el resto. Para eso:
--
-- 1) `traspasos` gana `items_rechazados` (espejo de `items_recibidos`,
--    pero con lo que NO se aceptó).
-- 2) El trigger deja de exigir que `movement_ids_salida` quede intacto en
--    la transición a "recibido" — ahora sí puede achicarse (se le sacan
--    los ids de las líneas rechazadas, para que ese array siga reflejando
--    solo los movimientos de salida que de verdad siguen respaldando el
--    traspaso).
-- 3) Nueva función `traspaso_restituir_rechazados()`: el almacén DESTINO
--    no tiene permiso de RLS para tocar `movements` del almacén ORIGEN
--    (aislamiento correcto) — por eso hace falta esta función
--    "security definer", igual patrón que `admin_cambiar_password`. Antes
--    de borrar nada valida que quien llama sea de verdad el destino (o el
--    admin) de ESE traspaso puntual, que siga "pendiente", y que los ids
--    que le pasan sean de verdad `movement_ids_salida` de ese traspaso —
--    no puede usarse para borrar cualquier otro movimiento.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
-- ==================================================================

alter table public.traspasos add column if not exists items_rechazados jsonb;

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
       or new.items_recibidos is distinct from old.items_recibidos
       or new.items_rechazados is distinct from old.items_rechazados then
      raise exception 'Al cancelar solo se puede cambiar el estado y el motivo.';
    end if;
  elsif new.estado = 'recibido' then
    if not admin and yo is distinct from old.almacen_destino then
      raise exception 'Solo el almacén destino puede recibir.';
    end if;
    -- movement_ids_salida SÍ puede achicarse acá (recepción parcial): se le
    -- sacan los ids de las líneas rechazadas. Todo lo demás del envío
    -- sigue intacto.
    if new.items is distinct from old.items
       or new.numero is distinct from old.numero
       or new.almacen_origen is distinct from old.almacen_origen
       or new.almacen_destino is distinct from old.almacen_destino
       or new.motivo_cancelacion is distinct from old.motivo_cancelacion then
      raise exception 'No se pueden modificar los datos de envío.';
    end if;
  else
    raise exception 'Transición de estado no permitida.';
  end if;

  return new;
end;
$$;

-- El destino restituye el stock de origen de las líneas que rechaza. Sin
-- esto, RLS bloquearía el borrado (destino no tiene permiso sobre
-- movements de otro almacén, correctamente) — esta función valida caso por
-- caso antes de tocar nada.
create or replace function public.traspaso_restituir_rechazados(traspaso_id text, movement_ids text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.traspasos%rowtype;
begin
  select * into t from public.traspasos where id = traspaso_id;
  if t.id is null then
    raise exception 'No existe el traspaso.';
  end if;
  if t.almacen_destino is distinct from public.almacen_actual() and not public.es_admin() then
    raise exception 'No autorizado.';
  end if;
  if t.estado is distinct from 'pendiente' then
    raise exception 'Este traspaso ya no está pendiente.';
  end if;

  delete from public.movements
  where id = any(movement_ids)
    and id = any(t.movement_ids_salida)
    and almacen = t.almacen_origen;
end;
$$;

grant execute on function public.traspaso_restituir_rechazados(text, text[]) to authenticated;
