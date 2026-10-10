-- Recepción parcial por cantidad: si el destino recibe MENOS de lo que el
-- origen envió en una línea (ej. se enviaron 4, se reciben 3), la unidad
-- que falta tiene que volver al stock del origen. Antes solo se
-- restituían las líneas destildadas por completo; la diferencia de una
-- línea aceptada a medias se perdía (salía del origen y no entraba al
-- destino).
--
-- La salida del origen se AJUSTA a lo que de verdad se recibió (4 -> 3)
-- en vez de crear un movimiento nuevo: así el historial del origen refleja
-- lo que realmente salió. RLS no deja al destino tocar movimientos del
-- origen, por eso la función privilegiada (mismo patrón que
-- traspaso_restituir_rechazados).
--
-- Idempotente a propósito: fija la cantidad ABSOLUTA (no resta), acotada
-- por lo enviado en el snapshot del traspaso (items), no por el valor
-- actual del movimiento. Así un reintento, o restaurar la cantidad
-- original si la recepción falla después, da el mismo resultado.
create or replace function public.traspaso_ajustar_salidas(
  traspaso_id text,
  movement_ids text[],
  cantidades numeric[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.traspasos%rowtype;
  i integer;
  pos integer;
  enviado numeric;
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
  if coalesce(array_length(movement_ids, 1), 0) is distinct from coalesce(array_length(cantidades, 1), 0) then
    raise exception 'Datos inconsistentes.';
  end if;

  for i in 1 .. coalesce(array_length(movement_ids, 1), 0) loop
    -- movement_ids_salida[n] corresponde a items[n] (mismo orden, ver
    -- enviarTraspaso en store.tsx); items es jsonb, indexa desde 0.
    pos := array_position(t.movement_ids_salida, movement_ids[i]);
    if pos is null then
      raise exception 'El movimiento no pertenece al traspaso.';
    end if;
    enviado := (t.items -> (pos - 1) ->> 'cantidad')::numeric;
    if cantidades[i] is null or cantidades[i] <= 0 or cantidades[i] > enviado then
      raise exception 'Cantidad inválida.';
    end if;

    update public.movements
    set cantidad = cantidades[i],
        valor = round(costo * cantidades[i], 2)
    where id = movement_ids[i]
      and almacen = t.almacen_origen;
  end loop;
end;
$$;

grant execute on function public.traspaso_ajustar_salidas(text, text[], numeric[]) to authenticated;
