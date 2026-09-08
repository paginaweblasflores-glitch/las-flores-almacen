import * as XLSX from "xlsx";
import type { Movement } from "../types";

// Descarga un arreglo de objetos como un .xlsx de una sola hoja.
export function descargarHoja(filename: string, data: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename);
}

// Fila de Excel para un movimiento. Formato compartido por "Exportar Excel" y
// por el respaldo del cierre anual, para que ambos archivos sean idénticos.
export function movimientoAFila(m: Movement) {
  return {
    Código: m.codigo,
    Descripción: m.descripcion,
    Categoría: m.categoria || "Sin categoría",
    Tipo: m.tipo,
    Cantidad: m.cantidad,
    "Unidad de medida": m.unidadMedida || "",
    "Costo unitario": m.costo,
    "Valor total": m.valor,
    Fecha: m.fecha.split("-").reverse().join("/"),
    Responsable: m.responsable,
    Área: m.area,
  };
}
