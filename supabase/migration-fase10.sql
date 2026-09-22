-- ==================================================================
-- Migración Fase 10 — el Administrador cambia la contraseña de cualquier cuenta
--
-- `supabase.auth.updateUser({password})` (lo que usaba antes Configuración)
-- solo puede cambiar la contraseña de la SESIÓN que está autenticada en ese
-- momento — nunca la de otra cuenta. Para que Corporación Las Flores le
-- pueda cambiar la contraseña a un almacenero (o a sí misma) desde su
-- panel, hace falta un mecanismo del lado del servidor con privilegio real
-- sobre auth.users. En vez de una Edge Function con la service role key
-- (infraestructura nueva: supabase login + functions deploy), se usa una
-- función SQL "security definer" que escribe el hash bcrypt directo —
-- mismo permiso con el que ya venimos corriendo los `update auth.users`
-- de las migraciones anteriores, sin nada nuevo que desplegar.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente.
-- ==================================================================

create extension if not exists pgcrypto with schema extensions;

-- Cambia la contraseña de CUALQUIER cuenta (almacenero o el propio admin).
-- Sensible: escribe directo en auth.users. Por eso "security definer" +
-- search_path vacío (todo con nombre completo, para que nadie pueda
-- colarle una función/tabla propia con el mismo nombre corto) + el chequeo
-- de es_admin() adentro, no solo confiado a quién puede llamarla — así
-- cualquier sesión puede invocarla, pero solo la del admin hace algo.
create or replace function public.admin_cambiar_password(objetivo_email text, nueva_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede hacer esto.';
  end if;
  if nueva_password is null or length(nueva_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(nueva_password, extensions.gen_salt('bf')),
      updated_at = now()
  where email = objetivo_email;

  if not found then
    raise exception 'No existe una cuenta con ese correo.';
  end if;
end;
$$;

grant execute on function public.admin_cambiar_password(text, text) to authenticated;
