# Sistema Almacén — Las Flores

Aplicación web de control de inventario para el almacén de Restaurante Las Flores.
Stack: **React 19 + Vite + Tailwind CSS v4 + Supabase**. Desplegada en **Vercel**.

## Servidor de desarrollo

```bash
pnpm install
pnpm dev          # Vite en el puerto $PORT (por defecto 8443), con hot reload
pnpm run build    # compilación de producción a dist/
pnpm run preview  # sirve la compilación de dist/
```

## Estructura del proyecto

- `src/main.tsx` — punto de entrada; monta `src/App.tsx` dentro de `ToastProvider`
- `src/App.tsx` — componente raíz: autenticación con Supabase, sidebar responsive y enrutado entre pantallas
- `src/components/` — pantallas y formularios (Login, Dashboard, Registrar, Inventory, Entries, Exits, DateSearch, CodeSearch, ExportExcel, los modales de edición) más `ComboBox` (desplegable editable), `Pager` (paginación)
- `src/store.tsx` — estado global y sincronización con Supabase; el inventario y las listas (categorías, áreas, unidades) se derivan de los movimientos; la carga pagina de a 1000 filas
- `src/toast.tsx` — avisos en pantalla (`useToast`, `<ToastProvider>`)
- `src/supabaseClient.ts` — cliente de Supabase y constantes de acceso
- `src/types.ts` — tipos (`Movement`, `InventoryItem`), listas por defecto (`AREAS`, `DEFAULT_CATEGORIES`, `UNIDADES_MEDIDA`), `MARGEN_PRECIO_VENTA`, `AVISOS_VOLUMEN`
- `src/utils/image.ts` — redimensionado y compresión de imágenes de producto
- `src/utils/storage.ts` — sube la imagen comprimida a Supabase Storage (bucket `productos`); si falla usa un data URL
- `src/index.css` — CSS global: `@import 'tailwindcss'`, tokens de marca (`@theme`), controles base y reglas de impresión
- `index.html` — shell HTML de Vite; `site.config.json` complementa los metadatos vía `vite.config.ts`
- `supabase/schema.sql` — esquema completo (tablas, índices, RLS, bucket de Storage, semillas). `supabase/migration-*.sql` — migraciones incrementales para bases de versiones anteriores
- `scripts/import-almacen.mjs` — importador puntual del inventario desde el Excel de Rio; lee `doc/…​.xlsm` (no versionado) o `IMPORT_XLSX`. Modos `--dry-run` y `--sql`
- `vite.config.ts` — configuración de Vite (React, Tailwind v4, alias `@` → `src`)
- `.mise.toml` — versiones de Node.js y pnpm

## Estilos

**Tailwind CSS v4** vía el plugin `@tailwindcss/vite`. `src/index.css` importa Tailwind con
`@import 'tailwindcss';` y define los tokens de la marca en un bloque `@theme` (escala `brand-*`,
neutros cálidos, fuentes). Usar las utilidades de Tailwind directamente en el JSX y poner CSS global
o personalización del tema en `src/index.css`. No hace falta archivo de configuración de Tailwind ni
de PostCSS.

Las `@import` de CSS van primero, luego las reglas `@font-face` y los valores por defecto de fuente.

## Calidad de código

- Usar comillas dobles para cadenas con apóstrofes (`"We're here to help"`), o escaparlos en cadenas
  con comillas simples. Un apóstrofe sin escapar dentro de comillas simples rompe el build.
- Cerrar todas las etiquetas JSX y balancear las llaves.
- Exportar los componentes como export por defecto.
