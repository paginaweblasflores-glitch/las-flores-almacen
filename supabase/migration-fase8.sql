-- ==================================================================
-- Migración Fase 8 — arregla la numeración de comprobantes por almacén
--
-- Bug encontrado: cuando la fase 6 separó los datos por almacén, a la tabla
-- `comprobantes` le agregó la columna `almacen` pero se olvidó de actualizar
-- su restricción de unicidad — siguió siendo `unique (tipo, periodo, numero)`
-- (de la fase 5, antes de que existiera más de un almacén), sin `almacen`.
-- `categories` sí se corrigió bien en su momento; a `comprobantes` se le
-- pasó por alto.
--
-- Efecto real: el primer comprobante de Hotel Umaru de cada tipo (p. ej. su
-- "E-1") choca con el "E-1" que ya existe de Restaurante Las Flores para el
-- mismo año, porque para la base son "el mismo" número — no se guarda el
-- comprobante (el movimiento sí queda guardado, por eso el aviso dice
-- "los movimientos se guardaron, pero no el comprobante").
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
-- ==================================================================

alter table public.comprobantes drop constraint if exists comprobantes_tipo_periodo_numero_key;

alter table public.comprobantes
  add constraint comprobantes_almacen_tipo_periodo_numero_key unique (almacen, tipo, periodo, numero);
