-- Corrige productos.created_at: al migrar el catálogo compartido
-- (migration-fase13.sql) los 333 productos existentes quedaron con
-- created_at = el momento en que corrió esa migración (hoy), no la fecha
-- real en que cada uno se registró por primera vez — eso infla cualquier
-- reporte de "productos nuevos en el rango" con productos que en realidad
-- son viejos. Acá se recalcula usando el primer movimiento real de cada
-- código (movements.created_at más antiguo) — eso sí refleja cuándo se
-- registró de verdad. Solo toca productos que tienen movimientos: el
-- código 14 (creado manual, sin movimientos, para tapar el hueco de la
-- numeración) queda con su fecha real de creación, que es correcta tal
-- cual está.
update public.productos p
set created_at = m.primero
from (
  select upper(trim(codigo)) as codigo, min(created_at) as primero
  from public.movements
  group by upper(trim(codigo))
) m
where p.codigo = m.codigo;
