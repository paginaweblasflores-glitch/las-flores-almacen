# Sistema Almacen

Aplicacion web de control de inventario construida con React, Vite, Tailwind CSS y Supabase.

## Requisitos

- Node.js 20 o superior
- pnpm 11 o npm
- Un proyecto de Supabase

## Instalacion

```bash
pnpm install
pnpm dev
```

Para crear una compilacion de produccion:

```bash
pnpm run build
```

## Importar almacen.xlsx

El archivo `src/xlsx/almacen.xlsx` contiene 329 productos. Para importarlo en Supabase, asegúrate de haber creado el usuario de autenticación y ejecuta en PowerShell:

```powershell
$env:IMPORT_PASSWORD = "TU_CONTRASEÑA_DE_SUPABASE"
pnpm run import:almacen
Remove-Item Env:IMPORT_PASSWORD
```

El importador usa IDs deterministas y `upsert`, por lo que puede repetirse sin duplicar los registros. Importa las entradas y salidas de cada código, conserva el stock calculado y no guarda la contraseña.

## Variables de entorno

Copia `.env.example` como `.env` y completa los valores de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_tu-clave
```

El archivo `.env` esta excluido por Git y nunca debe subirse al repositorio. Usa solamente la clave Publishable o anon publica. Nunca uses una clave `sb_secret_` en el frontend.

En Vercel, agrega las mismas variables en **Project Settings > Environment Variables** para el entorno Production y realiza un nuevo deploy.

## Configuracion de Supabase

1. Abre el **SQL Editor** de tu proyecto Supabase.
2. Ejecuta el contenido de `supabase/schema.sql`.
3. En **Authentication > Users**, crea el usuario de acceso:
   - Usuario de la aplicacion: `Almacen Las Flores`
   - Email de Supabase: `almacen2026@almacen.local`
   - Contraseña: configura una contraseña segura y confirmala automaticamente.
4. Verifica que RLS este habilitado en `categories` y `movements`.

La aplicacion usa Supabase Auth para validar el acceso y no almacena contraseñas en el codigo.

## Publicar en un repositorio nuevo

Crea primero un repositorio vacio en GitHub y reemplaza la URL:

```bash
git remote remove origin
git remote add origin https://github.com/USUARIO/NUEVO-REPOSITORIO.git
git add .
git commit -m "prepare project for new repository"
git push -u origin main
```

Antes de subir, revisa que `.env` no aparezca en `git status` ni en `git add`.

## Estructura principal

- `src/components`: pantallas y formularios.
- `src/store.tsx`: estado y sincronizacion con Supabase.
- `src/supabaseClient.ts`: cliente de Supabase.
- `supabase/schema.sql`: tablas, indices, politicas RLS y categorias iniciales.
