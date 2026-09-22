# Sistema Almacén — Las Flores

Aplicación web de control de inventario para el almacén de **Restaurante Las Flores**.

- **Entradas** y **Salidas** con carrito multi-ítem: se busca cada producto, se agrega con su
  cantidad y se registran todos juntos; la Salida imprime un comprobante para firmar
- **Nuevo producto**: alta de un producto que aún no existe en el almacén
- **Inventario** en tiempo real (stock calculado a partir de los movimientos)
- **Costo**, **unidad de medida** y **stock mínimo** por producto
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
   Crea las tablas, índices, políticas RLS (una por almacén), el bucket de Storage `productos` y las
   categorías iniciales de cada almacén.
   - Si la base viene de una versión anterior, ejecuta en su lugar las migraciones pendientes **en
     orden**: `supabase/migration-fase2.sql` → `migration-fase3.sql` → `migration-fase4.sql` →
     `migration-fase5.sql` → `migration-fase6.sql` → `migration-fase7.sql` (traspasos entre almacenes) →
     `migration-fase8.sql` (corrige la numeración de comprobantes por almacén) → `migration-fase9.sql`
     (cuenta Administrador con control total) → `migration-fase10.sql` (el Administrador cambia la
     contraseña de cualquier cuenta desde su panel).
2. **Authentication → Users → Add user**, una vez por cada cuenta de `CUENTAS` en `src/supabaseClient.ts`
   (email + contraseña, con *Auto Confirm User* activado). Hoy son tres:
   - `almacen2026@almacen.local` → usuario **Almacen Las Flores**, almacén `las-flores`.
   - `almacenumaru2026@almacen.local` → usuario **Almacen Hotel Umaru**, almacén `hotel-umaru`.
   - `corporacion2026@almacen.local` → usuario **Corporación Las Flores** (cuenta de administrador).
     Créalo **antes** de correr `migration-fase9.sql` (su último paso le asigna el rol con un
     `UPDATE`; si el usuario no existe todavía, ese `UPDATE` no hace nada y hay que volver a
     correrlo después).

   Cada cuenta de almacén tiene su **propio inventario, movimientos y comprobantes** — separados de
   verdad por Row Level Security según el `almacen` que trae el token de sesión (`app_metadata` del
   usuario en Supabase Auth), no solo por un filtro de la app. Para agregar una cuenta nueva hay que
   tocar **tres lugares**: su entrada en `CUENTAS`, el usuario en el Dashboard, y el
   `UPDATE auth.users … raw_app_meta_data` del paso 4 de `supabase/migration-fase6.sql` (las políticas
   de RLS no se tocan). Después de correr esa migración —o de agregar una cuenta nueva— hay que
   **cerrar sesión y volver a entrar** con esa cuenta para que el token traiga el `almacen` actualizado.

   La cuenta **Corporación Las Flores** (login del administrador) es distinta: no tiene su propio
   almacén, ve y escribe los datos de **cualquier** almacén (`app_metadata.role = "admin"`, no
   `almacen` — ver `migration-fase9.sql`).
   Al entrar aterriza en su propio panel con estadísticas de los dos almacenes, y desde ahí entra al
   panel completo de cualquiera de los dos sin volver a loguearse (`src/components/AdminDashboard.tsx`).
   Desde el botón de engranaje de ese panel (`src/components/AdminConfiguracion.tsx`) puede además
   cambiarle la contraseña a cualquier cuenta (la suya incluida) — los almaceneros ya no tienen esa
   opción en su propio Configuración, la centraliza el administrador (`migration-fase10.sql`).
3. Verifica que **RLS** esté habilitado en `movements`, `categories`, `comprobantes` y `storage.objects`.

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
y crea un movimiento por fila de las hojas **ENTRADAS** y **SALIDAS**, con su código, unidad, costo
y fecha reales. Usa IDs deterministas + `upsert`, así que se puede repetir sin duplicar.

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
