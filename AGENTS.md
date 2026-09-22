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
- `src/App.tsx` — componente raíz: autenticación con Supabase, sidebar responsive y enrutado entre pantallas. Deriva la `cuenta` activa (marca del panel: logo + nombre) del correo de la sesión vía `cuentaPorEmail`, no de lo que se eligió en el login, así es correcta también tras recargar la página. Si `cuenta.esAdmin` es verdadero y no se está "impersonando" ningún almacén (`verComoAlmacen === null`), renderiza `AdminDashboard` en vez del shell normal; al elegir un almacén ahí (`onEntrar`), `verComoAlmacen` pasa a ser esa clave y el resto de la app (sidebar, `StoreProvider`, `PageContent`) usa `almacenActivo`/`cuentaActiva` en vez de `cuenta`/`cuenta.almacen` directamente — es impersonación por estado de React, la sesión real (y el permiso RLS de fondo) siguen siendo los del Administrador. El widget de cuenta del sidebar suma "Volver al panel de Administrador" solo mientras se está impersonando.
- `src/components/` — pantallas y formularios:
  - `Registrar` (`Nuevo producto` en el menú) → `NewProductEntryForm`: alta de un producto que aún no existe (una sola entrada inicial).
  - `Entries` / `Exits` (`Entradas` / `Salidas`): cada uno monta `MovementCart` (carrito multi-ítem: buscar producto → agregar → cantidad → responsable → registrar; en Salida además motivo + impresión del comprobante) y debajo el `MovementsTable` con el historial.
  - `MovementCart` — carrito de registro; `addMovements` del store escribe todos los movimientos en un solo `insert`. `Field` — helper de campo etiquetado.
  - `ImageUploadField` — campo de imagen de producto reutilizable (elegir archivo, arrastrar y soltar, o pegar con Ctrl+V); lo usan `NewProductEntryForm`, `EditProductModal` y `EditMovementModal`. Sube con `utils/storage.ts`.
  - `Comprobantes` (`Comprobantes` en el menú): lista la copia congelada de cada comprobante de **salida** impreso (tabla `comprobantes`, filtrada a `tipo = 'Salida'`); permite ver el detalle y **reimprimir**. `ComprobanteSalida` — el comprobante térmico en sí (portal + hook `usarImpresionComprobante`), compartido por el carrito de salida y la reimpresión.
  - Numeración (`calcularNumeros`, `proximoNumero`, `etiquetaComprobante` del store): entradas y salidas generan un `Comprobante` con número correlativo por tipo (`E-1` / `S-1`), uno por registro (las líneas de un carrito comparten número), reinicia cada año (`periodo`). El N° sale de la tabla `comprobantes` (creada en `supabase/migration-fase5.sql`) y es fijo aunque después se edite o borre un movimiento. La columna "N° de Entrada / N° de Salida" aparece en ambos historiales; la copia reimprimible del módulo Comprobantes es solo para salidas.
  - `Dashboard`, `Inventory`, `CodeSearch` (`Buscar producto`: ficha e historial de un producto), `ExportExcel`, `Configuracion`, los modales de edición, `ComboBox` (desplegable editable), `Pager` (paginación).
  - `Configuracion` (`Configuración`): usuario y almacén de la cuenta activa (`cuenta` prop, ver `App.tsx`), **cierre de periodo** (cierre anual) y "Vaciar todo el almacén". Ya no tiene cambio de contraseña — eso lo centraliza el Administrador (ver `AdminConfiguracion` más abajo); acá solo queda una nota indicando que hay que contactarlo. El Dashboard muestra un aviso no descartable cuando hay movimientos del año anterior sin cerrar.
  - `Traspasos` (`Traspasos` en el menú, recibe `cuenta` igual que `Configuracion`): envía y recibe mercadería entre almacenes. `NuevoTraspasoForm` — carrito (igual patrón que `MovementCart`) que descuenta MI stock al toque y crea un traspaso "pendiente" (`enviarTraspaso` del store); el selector de destino excluye cuentas con `esAdmin`. `RecibirTraspasoModal` — por cada ítem recibido, el almacén destino lo matchea a un producto de SU propio inventario (buscador reutilizando `filtrarBusqueda`) o lo crea nuevo inline (mismos campos que `NewProductEntryForm`); solo entonces suma stock (`recibirTraspaso`). `cancelarTraspaso` sirve tanto para que origen cancele antes de que lo reciban como para que destino lo rechace (con motivo). `ComprobanteTraspaso`/`usarImpresionTraspaso` — mismo mecanismo de impresión que `ComprobanteSalida`, clonado (no generalizado). Es la única entidad de la app que un almacén ve sin ser dueño exclusivo de la fila — ver `supabase/migration-fase7.sql`.
  - `AdminDashboard` (pantalla propia, sin sidebar — es lo que ve la cuenta Administrador al entrar, antes de elegir un almacén): trae movimientos de LOS DOS almacenes con fetches directos a Supabase (`buildInventory`/`movementFromRow`, exportados de `store.tsx` para esto, sin pasar por `StoreProvider`) más los traspasos pendientes de cada uno, y muestra una tarjeta por almacén con sus KPIs (productos, unidades, por reponer, entradas/salidas, traspasos pendientes; el valor del inventario queda como dato secundario, no destacado) y un botón "Entrar al panel de…" (`onEntrar`, ver `App.tsx`). También arma un PDF resumen (jsPDF + `autoTable`) con una tabla por almacén. El botón de engranaje del header alterna a `AdminConfiguracion` (`vista` local) en vez de las tarjetas.
  - `AdminConfiguracion`: lista los dos almacenes reales (`CUENTAS.filter(c => !c.esAdmin)`, no la propia cuenta del administrador — esa contraseña la cambia el equipo de desarrollo directo en Supabase) con un "Cambiar contraseña" por fila que llama al RPC `admin_cambiar_password` (`supabase/migration-fase10.sql`) — es el único lugar de toda la app donde se puede cambiar la contraseña de OTRA cuenta; `auth.updateUser()` no sirve para eso, por eso hace falta esa función del lado de la base.
- `src/store.tsx` — estado global y sincronización con Supabase; el inventario y las listas (categorías, áreas, unidades) se derivan de los movimientos; la carga pagina de a 1000 filas. `addMovement` (uno) y `addMovements` (lote, con validación de stock acumulada y rollback si falla el insert). `cerrarAnio(anio)` + `construirCierre(movements, anio)`: el cierre anual archiva los movimientos con fecha ≤ 31/12 del año y los reemplaza por un saldo inicial por producto (Entrada fechada el 01/01 del año siguiente, `responsable = "SALDO INICIAL AAAA"`); crea los saldos, verifica y borra los archivados en lotes; un reintento no vuelve a crear saldos. `StoreProvider` recibe `almacen` (de `App.tsx`, viene de la cuenta activa o, para el Administrador, del almacén que esté impersonando; también expuesto en `useStore()`) y lo usa en **todas** las consultas/escrituras (`.eq("almacen", almacen)`, y en el payload de `movementToRow`/`comprobanteToRow`) y en las claves de `localStorage`, para que cada cuenta solo vea y guarde sus propios datos — la separación real la hace RLS en la base (ver `supabase/migration-fase6.sql`), esto es la segunda capa del lado de la app. `enviarTraspaso`/`recibirTraspaso`/`cancelarTraspaso` arman sus propios movimientos "sueltos" (como los saldos de `cerrarAnio`, sin comprobante E-/S-) con verificación fuerte (`.select("id")`) antes de tocar la tabla `traspasos` — la única consulta del store que no es de un solo almacén (`fetchAllTraspasos`, con `.or(almacen_origen.eq...,almacen_destino.eq...)`). `buildInventory` y `movementFromRow` están `export`ados (además de su uso interno) para que `AdminDashboard` pueda calcular inventario de cualquier almacén desde filas crudas de Supabase, sin montar `StoreProvider`.
- `src/utils/excel.ts` — `descargarHoja` (json → .xlsx de una hoja) y `movimientoAFila` (formato de fila compartido por Exportar Excel y el respaldo del cierre).
- `src/toast.tsx` — avisos en pantalla (`useToast`, `<ToastProvider>`)
- `src/supabaseClient.ts` — cliente de Supabase y `CUENTAS`: la lista de cuentas de acceso (usuario del login → email real de Supabase Auth → nombre, logo y **`almacen`** — la clave de aislamiento de datos de esa cuenta). Cada almacén tiene su propio inventario/movimientos/comprobantes/categorías, separados por Row Level Security: las políticas comparan `almacen` contra `public.almacen_actual()`, que lo lee del `app_metadata` del JWT de la sesión (no un mapeo de emails hardcodeado en la política — eso lo hace más fácil de escalar y evita que un typo en una política deje a una cuenta entera sin acceso a lo suyo). Agregar una cuenta nueva: sumar la entrada acá, crear el usuario en el Dashboard de Supabase, y correr un `update auth.users set raw_app_meta_data = … where email = …` (paso 4 de `migration-fase6.sql`) — las políticas RLS no cambian. La cuenta Administrador se marca con `esAdmin: true`: su `almacen` ("admin") nunca se usa para filtrar datos reales — en vez de `almacen_actual()`, sus políticas RLS pasan por `public.es_admin()` (lee `role` del `app_metadata`, ver `migration-fase9.sql`), un bypass que aplica a cualquier almacén. Ver README.
- `src/types.ts` — tipos (`Movement`, `InventoryItem`, `Traspaso`), listas por defecto (`AREAS`, `DEFAULT_CATEGORIES`, `UNIDADES_MEDIDA`)
- `src/utils/image.ts` — redimensionado y compresión de imágenes de producto
- `src/utils/storage.ts` — sube la imagen comprimida a Supabase Storage (bucket `productos`); si falla usa un data URL
- `src/index.css` — CSS global: `@import 'tailwindcss'`, tokens de marca (`@theme`), controles base y reglas de impresión
- `index.html` — shell HTML de Vite; `site.config.json` complementa los metadatos vía `vite.config.ts`
- `supabase/schema.sql` — esquema completo (tablas, índices, RLS, bucket de Storage, semillas). `supabase/migration-*.sql` — migraciones incrementales para bases de versiones anteriores
- `scripts/import-almacen.mjs` — importador puntual del inventario desde el Excel de Rio; lee `doc/…​.xlsm` (no versionado) o `IMPORT_XLSX`. Modos `--dry-run` y `--sql`
- `vite.config.ts` — configuración de Vite (React, Tailwind v4, alias `@` → `src`)
- `.mise.toml` — versiones de Node.js y pnpm
- `.github/workflows/keepalive.yml` — cron diario que hace una consulta de solo lectura a Supabase para que el proyecto (plan gratuito) no se pause por 7 días de inactividad. Necesita los secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY` en el repositorio.

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
