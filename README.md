# Sistema Almacén — Las Flores

Aplicación web de control de inventario para el almacén de Restaurante Las Flores.
Registro de entradas y salidas, inventario en tiempo real, costo / precio de venta,
stock mínimo con punto de reorden, fotos de producto y reportes a Excel.

**Stack:** React 19 + Vite + Tailwind CSS v4 + Supabase. Desplegada en **Vercel**.

## Requisitos

- Node.js 20 o superior
- pnpm 11 (o npm)
- Un proyecto de Supabase

## Desarrollo

```bash
pnpm install
pnpm dev          # servidor de Vite con hot reload
pnpm run build    # compilación de producción a dist/
pnpm run preview  # sirve dist/
```

## Variables de entorno

Copia `.env.example` como `.env` y completa los valores de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

`.env` está excluido por Git y nunca debe subirse. Usa solo la clave **anon / publishable**;
nunca una `sb_secret_` en el frontend.

## Configuración de Supabase

1. En el **SQL Editor** ejecuta `supabase/schema.sql` (crea tablas, índices,
   políticas RLS, categorías iniciales y el bucket `productos` de Storage).
   - Si la base ya existía de una versión anterior, ejecuta en su lugar las
     migraciones pendientes en orden: `supabase/migration-fase2.sql` y luego
     `supabase/migration-fase3.sql`.
2. En **Authentication > Users** crea el usuario de acceso:
   - Usuario en la app: `Almacen Las Flores`
   - Email de Supabase: `almacen2026@almacen.local`
   - Contraseña: segura, con "Auto Confirm User" activado.
3. Verifica que RLS esté habilitado en `categories` y `movements`.

## Despliegue en Vercel

1. En **Project Settings > Environment Variables** (entorno Production) carga
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. Aplica en Supabase las migraciones nuevas **antes** de promover el deploy
   (si una columna falta, los guardados fallan y la app lo avisa con un toast).
3. Cada push a `main` dispara un deploy automático.

## Importar inventario desde Excel (una sola vez)

El importador lee `doc/almacen.xlsx` (no versionado; también acepta la ruta en
`IMPORT_XLSX`). Requiere el usuario de autenticación ya creado. En PowerShell:

```powershell
$env:IMPORT_PASSWORD = "TU_CONTRASEÑA_DE_SUPABASE"
pnpm run import:almacen
Remove-Item Env:IMPORT_PASSWORD
```

Usa IDs deterministas y `upsert`, así que puede repetirse sin duplicar registros.
No guarda la contraseña.

## Estructura principal

- `src/components/` — pantallas y formularios
- `src/store.tsx` — estado global e sincronización con Supabase
- `src/toast.tsx` — avisos en pantalla (errores de Supabase, confirmaciones)
- `src/supabaseClient.ts` — cliente de Supabase
- `src/utils/` — procesado de imágenes y subida a Storage
- `supabase/schema.sql` — esquema completo · `supabase/migration-*.sql` — migraciones incrementales
- `scripts/import-almacen.mjs` — importador puntual del inventario
