# Sistema Almacén — Las Flores

Aplicación web de control de inventario para el almacén de **Restaurante Las Flores**.

- Registro de **entradas y salidas** con validación de stock
- **Inventario** en tiempo real (stock calculado a partir de los movimientos)
- **Costo**, **precio de venta** (sugerido por margen), **unidad de medida** y **stock mínimo** por producto
- **Foto** por producto (Supabase Storage)
- Buscador por código, consulta por rango de fechas, exportación a Excel
- **Panel de Inicio como reporte**: KPIs, valor del inventario, gráficas y **descarga en PDF**
- Avisos automáticos cuando conviene hacer limpieza de datos antiguos

**Stack:** React 19 · Vite · Tailwind CSS v4 · Supabase · Recharts. Desplegada en **Vercel**.

## Requisitos

- Node.js 22
- pnpm 10 (`corepack enable` o [mise](https://mise.jdx.dev) con el `.mise.toml` incluido)
- Un proyecto de Supabase

## Desarrollo

```bash
pnpm install
pnpm dev          # servidor de Vite con hot reload
pnpm run build    # compilación de producción a dist/
pnpm run preview  # sirve dist/
```

## Variables de entorno

Copia `.env.example` como `.env` y completa:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

`.env` está en `.gitignore` y **nunca se sube**. Usa solo la clave **anon / publishable**; nunca una `sb_secret_` en el frontend.

## Configuración de Supabase

1. **SQL Editor → ejecutar `supabase/schema.sql`** (una vez, en una base nueva).
   Crea las tablas, índices, políticas RLS, el bucket de Storage `productos` y las categorías iniciales.
   - Si la base viene de una versión anterior, ejecuta en su lugar las migraciones pendientes **en orden**:
     `supabase/migration-fase2.sql` → `supabase/migration-fase3.sql`.
2. **Authentication → Users → Add user:**
   - Email: `almacen2026@almacen.local`
   - Contraseña: una segura, con *Auto Confirm User* activado
   - En la app se selecciona el usuario **Almacen Las Flores** (mapea a ese email).
3. Verifica que **RLS** esté habilitado en `movements`, `categories` y `storage.objects`.

> Los archivos de `supabase/` son el **esquema y las migraciones** (código de configuración, no datos).
> El volcado de datos que genera el importador (`supabase/import-inventario.sql`) sí está ignorado.

## Despliegue en Vercel

1. En **Project Settings → Environment Variables** (entorno Production) carga
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. Aplica en Supabase las migraciones nuevas **antes** de promover el deploy
   (si falta una columna, los guardados fallan y la app lo avisa con un toast).
3. Cada push a `main` dispara el deploy automático.

## Importar el inventario desde Excel (una sola vez)

El importador lee `doc/<libro>.xlsm` (carpeta `doc/` **no versionada**; también acepta la ruta en `IMPORT_XLSX`)
y crea un movimiento por fila de las hojas **ENTRADAS** y **SALIDAS**, con su código, unidad, costo,
precio de venta y fecha reales. Usa IDs deterministas + `upsert`, así que se puede repetir sin duplicar.

```powershell
# Revisar sin escribir nada
node scripts/import-almacen.mjs --dry-run

# Generar un .sql para pegar en el SQL Editor de Supabase (sin contraseña)
node scripts/import-almacen.mjs --sql        # → supabase/import-inventario.sql

# O importar directo (pide la contraseña del usuario de Supabase)
$env:IMPORT_PASSWORD = "TU_CONTRASEÑA"
pnpm run import:almacen
Remove-Item Env:IMPORT_PASSWORD
```

## Mantenimiento

- Los productos importados quedan con **costo 0** y en la categoría/área por defecto (el Excel no traía esos campos).
  Conviene completarlos poco a poco desde **Inventario → editar**.
- Cuando la base supera los umbrales de `AVISOS_VOLUMEN` (`src/types.ts`), el Panel de Inicio muestra un aviso:
  exportar a Excel los movimientos antiguos (mes por mes) y eliminarlos para mantener el sistema ágil.

## Estructura

- `src/components/` — pantallas y formularios
- `src/store.tsx` — estado global y sincronización con Supabase
- `src/types.ts` — tipos y listas por defecto
- `src/utils/` — procesado y subida de imágenes
- `supabase/` — esquema (`schema.sql`) y migraciones incrementales
- `scripts/import-almacen.mjs` — importador puntual del inventario

Más detalle técnico para desarrollo asistido por IA en `AGENTS.md`.
