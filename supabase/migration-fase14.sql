-- Numeración de traspasos: pasa de "correlativo por almacén de origen" a
-- un correlativo ÚNICO entre TODOS los almacenes. Con el correlativo por
-- origen, Las Flores y Umaru podían generar cada uno su propio "T-1" —
-- dos traspasos distintos con el mismo número en la misma tabla, confuso
-- en el historial que ven los dos lados. Además, calcularlo en el cliente
-- (máximo local + 1) ya no alcanza para que sea confiable con más de dos
-- almacenes: cada cuenta solo ve (por RLS) los traspasos donde participa,
-- así que no puede calcular un máximo global por su cuenta. Por eso el
-- número ahora lo asigna una función del lado de la base, atómica, que no
-- depende de qué traspasos pueda ver quien la llama.

-- 1) Reordena los traspasos que ya existen: uno por período, por orden de
--    creación, sin importar quién los originó — deja el historial en el
--    mismo orden cronológico que ya tenía, solo renumerado.
--    El trigger traspasos_before_update (migration-fase9/11.sql) valida
--    quién puede tocar cada fila leyendo el JWT de la sesión — acá no hay
--    uno (esto corre como vos, desde el SQL Editor), así que se desactiva
--    nada más para este UPDATE administrativo puntual.
alter table public.traspasos disable trigger traspasos_before_update;

with ordenados as (
  select id, row_number() over (partition by periodo order by created_at, id) as rn
  from public.traspasos
)
update public.traspasos t
set numero = o.rn
from ordenados o
where t.id = o.id;

alter table public.traspasos enable trigger traspasos_before_update;

-- 2) La restricción de unicidad pasa de (almacen_origen, periodo, numero)
--    a (periodo, numero) — global.
alter table public.traspasos drop constraint if exists traspasos_almacen_origen_periodo_numero_key;
alter table public.traspasos add constraint traspasos_periodo_numero_key unique (periodo, numero);

-- 3) Contador atómico por período. Un simple "select max(numero)+1" desde
--    el cliente tiene dos problemas: no es atómico (dos envíos casi
--    simultáneos podrían calcular el mismo número) y, con RLS, cada cuenta
--    solo ve una parte de la tabla. Esta función corre con permisos
--    propios (no los de quien llama) y hace el incremento con un solo
--    UPSERT, que Postgres serializa fila por fila — no puede haber dos
--    llamadas que saquen el mismo número.
create table if not exists public.traspaso_contadores (
  periodo text primary key,
  ultimo  integer not null default 0
);
alter table public.traspaso_contadores enable row level security;

insert into public.traspaso_contadores (periodo, ultimo)
select periodo, max(numero) from public.traspasos group by periodo
on conflict (periodo) do update set ultimo = greatest(public.traspaso_contadores.ultimo, excluded.ultimo);

create or replace function public.siguiente_numero_traspaso(p_periodo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.traspaso_contadores (periodo, ultimo)
  values (p_periodo, 1)
  on conflict (periodo) do update set ultimo = public.traspaso_contadores.ultimo + 1
  returning ultimo into n;
  return n;
end;
$$;

grant execute on function public.siguiente_numero_traspaso(text) to authenticated;
