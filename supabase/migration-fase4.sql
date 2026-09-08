-- ==================================================================
-- Migración Fase 4 — elimina "precio de venta"
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
--
-- La aplicación ya no usa esta columna (Rio no vende nada; el almacén
-- solo lleva el registro de existencias). Estaba "dormida" con valor 0.
-- Esto la borra definitivamente. No afecta a la app en ejecución.
-- ==================================================================

alter table public.movements drop column if exists precio_venta;
