import fs from "node:fs";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

function readEnv() {
  const values = {};
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim();
  }
  return values;
}

const env = readEnv();
const password = process.env.IMPORT_PASSWORD;
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !password) {
  throw new Error("Faltan VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY o IMPORT_PASSWORD.");
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: authError } = await supabase.auth.signInWithPassword({
  email: "almacen2026@almacen.local",
  password,
});
if (authError) throw new Error(`No se pudo autenticar: ${authError.message}`);

const workbook = XLSX.readFile("src/xlsx/almacen.xlsx");
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
const importedAt = new Date().toISOString().slice(0, 10);
const movements = [];

for (const row of rows) {
  const codigo = String(row.CODIGO).trim();
  const descripcion = String(row.DESCRIPCION).trim();
  const entradas = Number(row.ENTRADAS || 0);
  const salidas = Number(row.SALIDAS || 0);
  const base = {
    codigo,
    descripcion,
    valor: 0,
    fecha: importedAt,
    responsable: "Importación almacen.xlsx",
    area: "Almacén 1",
    categoria: "Atención y servicio",
    imagen: row["IMAGEN REF."] ? String(row["IMAGEN REF."]) : null,
    motivo: `Importación de almacen.xlsx (${row["UNI. MEDIDAD"] || "sin unidad"})`,
  };

  if (entradas > 0) movements.push({ ...base, id: `xlsx-${codigo}-entrada`, cantidad: entradas, tipo: "Entrada" });
  if (salidas > 0) movements.push({ ...base, id: `xlsx-${codigo}-salida`, cantidad: salidas, tipo: "Salida" });
}

for (let index = 0; index < movements.length; index += 500) {
  const { error } = await supabase.from("movements").upsert(movements.slice(index, index + 500), { onConflict: "id" });
  if (error) throw new Error(`Error importando lote ${index}: ${error.message}`);
}

console.log(`Importación completada: ${rows.length} productos y ${movements.length} movimientos.`);