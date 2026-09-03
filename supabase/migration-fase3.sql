-- ==================================================================
-- Migración Fase 3 — stock mínimo / punto de reorden
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
-- ==================================================================

alter table public.movements add column if not exists stock_minimo numeric not null default 0;
