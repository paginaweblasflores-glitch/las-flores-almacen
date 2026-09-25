-- Bug real (no de esta sesión, de antes): cuando el DESTINO rechaza un
-- traspaso entero, cancelarTraspaso primero marca el traspaso 'cancelado'
-- y RECIÉN AHÍ llama a traspaso_restituir_rechazados para devolverle el
-- stock al origen. Esa función revisaba "estado = pendiente" — pero para
-- ese momento el traspaso YA está 'cancelado' (lo acaba de cambiar la
-- misma operación), así que la restitución fallaba siempre con "Este
-- traspaso ya no está pendiente." y el stock del origen se quedaba
-- descontado para siempre. (La recepción parcial no tenía este problema:
-- ahí la función se llama ANTES de marcar 'recibido', con el traspaso
-- todavía pendiente.)
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
  if t.estado is distinct from 'pendiente' and t.estado is distinct from 'cancelado' then
    raise exception 'Este traspaso ya no se puede restituir.';
  end if;

  delete from public.movements
  where id = any(movement_ids)
    and id = any(t.movement_ids_salida)
    and almacen = t.almacen_origen;
end;
$$;
