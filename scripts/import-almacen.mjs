import fs from "node:fs";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Importa el inventario de Rio desde su libro de Excel a Supabase.
// Lee las hojas ENTRADAS y SALIDAS del .xlsm y crea un movimiento por fila,
// conservando código, unidad de medida, costo, precio de venta y fecha.
// El stock se calcula en la app a partir de esos movimientos.
//
// Uso:
//   $env:IMPORT_PASSWORD = "..."      # contraseña de almacen2026@almacen.local
//   pnpm run import:almacen           # o: node scripts/import-almacen.mjs --dry-run
//   Remove-Item Env:IMPORT_PASSWORD
//
// El .xlsm NO se versiona. Ruta por defecto abajo; se puede cambiar con IMPORT_XLSX.
// IDs deterministas por fila -> se puede repetir sin duplicar (upsert).
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const SQL_OUT = process.argv.includes("--sql");
const XLSX_PATH =
  process.env.IMPORT_XLSX || "doc/SISTEMA DE INVENTARIO CORPORATIVO FINAL 1.xlsm";
const AUTH_EMAIL = "almacen2026@almacen.local";
const CATEGORIA_DEFECTO = "Atención y servicio";
const AREA_ENTRADA = "Almacén 1";

function readEnv() {
  const values = {};
  if (!fs.existsSync(".env")) return values;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim();
  }
  return values;
}

function excelSerialToISO(serial) {
  if (typeof serial !== "number" || !isFinite(serial)) {
    return new Date().toISOString().slice(0, 10);
  }
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function titleCase(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function num(value) {
  const n = Number(value);
  return isFinite(n) && n > 0 ? n : 0;
}

if (!fs.existsSync(XLSX_PATH)) {
  throw new Error(`No se encontró ${XLSX_PATH}. Copia el archivo o define IMPORT_XLSX.`);
}

const workbook = XLSX.readFile(XLSX_PATH);
const entradasRows = XLSX.utils.sheet_to_json(workbook.Sheets["ENTRADAS"], { defval: null });
const salidasRows = XLSX.utils.sheet_to_json(workbook.Sheets["SALIDAS"], { defval: null });

const movements = [];
let sinCodigo = 0;

entradasRows.forEach((row, i) => {
  const codigo = row.CODIGO == null ? "" : String(row.CODIGO).trim();
  const descripcion = row.DESCRIPCION == null ? "" : String(row.DESCRIPCION).trim();
  const cantidad = num(row.CANTIDAD);
  if (!codigo || !descripcion || cantidad <= 0) {
    sinCodigo++;
    return;
  }
  const costo = num(row.COSTO);
  movements.push({
    id: `xlsm-ent-${i}`,
    codigo,
    descripcion,
    cantidad,
    unidad_medida: row["UNI. MEDIDAD"] ? String(row["UNI. MEDIDAD"]).trim() : null,
    costo,
    precio_venta: num(row["PRECIO VENTA"]),
    stock_minimo: 0,
    valor: costo * cantidad,
    fecha: excelSerialToISO(row.FECHA),
    responsable: "Importación Excel",
    area: AREA_ENTRADA,
    categoria: CATEGORIA_DEFECTO,
    imagen: null,
    motivo: "Importación del Excel de inventario",
    tipo: "Entrada",
  });
});

salidasRows.forEach((row, i) => {
  const codigo = row.CODIGO == null ? "" : String(row.CODIGO).trim();
  const descripcion = row.DESCRIPCION == null ? "" : String(row.DESCRIPCION).trim();
  const cantidad = num(row.CANTIDAD);
  if (!codigo || !descripcion || cantidad <= 0) {
    sinCodigo++;
    return;
  }
  const costo = num(row.COSTO);
  const responsable = row.RESPOSABLE ? String(row.RESPOSABLE).trim() : "Importación Excel";
  movements.push({
    id: `xlsm-sal-${i}`,
    codigo,
    descripcion,
    cantidad,
    unidad_medida: row["UNI. MEDIDAD"] ? String(row["UNI. MEDIDAD"]).trim() : null,
    costo,
    precio_venta: num(row["PRECIO VENTA"]),
    stock_minimo: 0,
    valor: costo * cantidad,
    fecha: excelSerialToISO(row.FECHA),
    responsable: responsable || "Importación Excel",
    area: row["AREA DESTINO"] ? titleCase(row["AREA DESTINO"]) : AREA_ENTRADA,
    categoria: CATEGORIA_DEFECTO,
    imagen: null,
    motivo: "Salida importada del Excel de inventario",
    tipo: "Salida",
  });
});

const entradas = movements.filter((m) => m.tipo === "Entrada");
const salidas = movements.filter((m) => m.tipo === "Salida");
const productos = new Set(movements.map((m) => m.codigo));

console.log(`Archivo:   ${XLSX_PATH}`);
console.log(`Entradas:  ${entradas.length} movimientos`);
console.log(`Salidas:   ${salidas.length} movimientos`);
console.log(`Productos distintos: ${productos.size}`);
console.log(`Filas descartadas (sin código/descr./cantidad): ${sinCodigo}`);
console.log(
  `Fechas: ${movements.reduce((a, m) => (m.fecha < a ? m.fecha : a), "9999")} → ${movements.reduce(
    (a, m) => (m.fecha > a ? m.fecha : a),
    "0000"
  )}`
);
console.log("Ejemplo:", JSON.stringify(movements[0], null, 2));

if (SQL_OUT) {
  const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
  const n = (v) => Number(v || 0);
  const cols =
    "id, codigo, descripcion, cantidad, unidad_medida, costo, precio_venta, stock_minimo, valor, fecha, responsable, area, categoria, tipo, motivo";
  const values = movements
    .map(
      (m) =>
        `  (${q(m.id)}, ${q(m.codigo)}, ${q(m.descripcion)}, ${n(m.cantidad)}, ${q(m.unidad_medida)}, ` +
        `${n(m.costo)}, ${n(m.precio_venta)}, ${n(m.stock_minimo)}, ${n(m.valor)}, ${q(m.fecha)}, ` +
        `${q(m.responsable)}, ${q(m.area)}, ${q(m.categoria)}, ${q(m.tipo)}, ${q(m.motivo)})`
    )
    .join(",\n");
  const sql =
    `-- ==================================================================\n` +
    `-- Importación del inventario desde el Excel de Rio\n` +
    `-- ${entradas.length} entradas + ${salidas.length} salidas = ${movements.length} movimientos (${productos.size} productos)\n` +
    `-- Ejecutar en el SQL Editor de Supabase. Idempotente: ON CONFLICT DO NOTHING.\n` +
    `-- ==================================================================\n\n` +
    `insert into public.movements\n  (${cols})\nvalues\n${values}\non conflict (id) do nothing;\n`;
  fs.writeFileSync("supabase/import-inventario.sql", sql, "utf8");
  console.log(`\nEscrito supabase/import-inventario.sql (${movements.length} filas).`);
  process.exit(0);
}

if (DRY_RUN) {
  console.log("\n--dry-run: no se escribió nada en Supabase.");
  process.exit(0);
}

const env = readEnv();
const password = process.env.IMPORT_PASSWORD;
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !password) {
  throw new Error("Faltan VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY o IMPORT_PASSWORD.");
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: authError } = await supabase.auth.signInWithPassword({ email: AUTH_EMAIL, password });
if (authError) throw new Error(`No se pudo autenticar: ${authError.message}`);

for (let i = 0; i < movements.length; i += 500) {
  const lote = movements.slice(i, i + 500);
  const { error } = await supabase.from("movements").upsert(lote, { onConflict: "id" });
  if (error) throw new Error(`Error importando lote ${i}: ${error.message}`);
  console.log(`  lote ${i}–${i + lote.length} OK`);
}

console.log(`\nImportación completada: ${movements.length} movimientos de ${productos.size} productos.`);
