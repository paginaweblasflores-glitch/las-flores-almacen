-- ==================================================================
-- Migración Fase 7 — traspasos de mercadería entre almacenes
-- Cualquiera de los dos almacenes (Las Flores / Hotel Umaru) puede enviarle
-- productos al otro. El envío descuenta stock al origen de inmediato y crea
-- un traspaso "pendiente"; el destino lo recibe más tarde (recién ahí suma
-- su propio stock) o lo rechaza. Es la única tabla donde una sesión ve/toca
-- legítimamente filas que no son 100% "suyas" — por eso lleva RLS + trigger
-- dedicados, en vez del simple `almacen = almacen_actual()` del resto del
-- esquema.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
-- ==================================================================

create table if not exists public.traspasos (
  id                    text primary key,
  numero                integer not null,
  periodo               text not null,               -- año; correlativo por almacén_origen (igual que E-/S-)
  almacen_origen        text not null,
  almacen_destino       text not null check (almacen_destino <> almacen_origen),
  estado                text not null default 'pendiente' check (estado in ('pendiente', 'recibido', 'cancelado')),
  fecha_envio           date not null,
  responsable_envio     text not null,
  motivo                text,
  items                 jsonb not null default '[]'::jsonb,
  movement_ids_salida   text[] not null default '{}',
  fecha_recepcion       date,
  responsable_recepcion text,
  items_recibidos       jsonb,
  movement_ids_entrada  text[] not null default '{}',
  motivo_cancelacion    text,
  created_at            timestamptz not null default now(),
  unique (almacen_origen, periodo, numero)
);

create index if not exists traspasos_origen_idx on public.traspasos (almacen_origen);
create index if not exists traspasos_destino_idx on public.traspasos (almacen_destino);

alter table public.traspasos enable row level security;

-- Visible para el origen y para el destino.
drop policy if exists "traspasos_select" on public.traspasos;
create policy "traspasos_select"
  on public.traspasos for select
  to authenticated
  using (almacen_origen = public.almacen_actual() or almacen_destino = public.almacen_actual());

-- Solo el origen puede crear un traspaso, y siempre arranca "pendiente" y
-- sin nada del lado de recepción todavía.
drop policy if exists "traspasos_insert" on public.traspasos;
create policy "traspasos_insert"
  on public.traspasos for insert
  to authenticated
  with check (
    almacen_origen = public.almacen_actual()
    and estado = 'pendiente'
    and movement_ids_entrada = '{}'
    and items_recibidos is null
  );

-- Ambos lados pueden actualizar (el trigger de abajo decide qué le permite a cada uno).
drop policy if exists "traspasos_update" on public.traspasos;
create policy "traspasos_update"
  on public.traspasos for update
  to authenticated
  using (almacen_origen = public.almacen_actual() or almacen_destino = public.almacen_actual())
  with check (almacen_origen = public.almacen_actual() or almacen_destino = public.almacen_actual());

-- RLS por sí sola no distingue "el origen solo puede cancelar" de "el
-- destino solo puede recibir" a nivel de columna — lo valida este trigger.
-- OJO: usa "is distinct from", nunca "<>": varias columnas son NULL-eables
-- (items_recibidos, fecha_recepcion, responsable_recepcion, motivo,
-- motivo_cancelacion) y en Postgres "null <> algo" da NULL, no TRUE — con
-- "<>" común el chequeo quedaría roto en silencio para esas columnas.
create or replace function public.traspasos_validar_transicion()
returns trigger
language plpgsql
as $$
declare
  yo text := public.almacen_actual();
begin
  if yo is distinct from old.almacen_origen and yo is distinct from old.almacen_destino then
    raise exception 'No autorizado.';
  end if;
  if old.estado is distinct from 'pendiente' then
    raise exception 'Este traspaso ya no está pendiente.';
  end if;

  if new.estado = 'cancelado' then
    -- El origen cancela (se arrepiente antes de que lo reciban) o el
    -- destino rechaza (no es lo que pidió) — cualquiera de los dos lados.
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
    if yo is distinct from old.almacen_destino then
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

drop trigger if exists traspasos_before_update on public.traspasos;
create trigger traspasos_before_update
  before update on public.traspasos
  for each row
  execute function public.traspasos_validar_transicion();
