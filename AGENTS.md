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

- `src/main.tsx` — punto de entrada; importa `src/index.css` y monta `src/App.tsx` en `#root`
- `src/App.tsx` — componente raíz: autenticación con Supabase, sidebar y enrutado entre páginas
- `src/components/` — pantallas y formularios (Login, Dashboard, Registrar, Inventory, Entries, Exits, DateSearch, CodeSearch, ExportExcel y los modales de edición)
- `src/store.tsx` — estado global (movimientos, inventario derivado, categorías) y sincronización con Supabase
- `src/supabaseClient.ts` — cliente de Supabase y constantes de acceso
- `src/types.ts` — tipos (`Movement`, `InventoryItem`), áreas y categorías por defecto
- `src/utils/image.ts` — redimensionado y compresión de imágenes de producto
- `src/index.css` — entrada global de CSS, `@import 'tailwindcss'` y tokens de diseño
- `index.html` — shell HTML de Vite con `#root`
- `site.config.json` — título, descripción e idioma del sitio (los inyecta un plugin de `vite.config.ts`)
- `supabase/schema.sql` — tablas, índices, políticas RLS y categorías iniciales
- `scripts/import-almacen.mjs` — importador puntual del inventario; lee `doc/almacen.xlsx` (no versionado) o la ruta de `IMPORT_XLSX`
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
