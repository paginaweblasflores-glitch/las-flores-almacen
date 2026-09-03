import { useState } from "react";
import * as XLSX from "xlsx";
import { useStore } from "../store";
import type { MovementType } from "../types";

function exportSheet(filename: string, data: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename);
}

export default function ExportExcel() {
  const { movements, inventory } = useStore();
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [tipo, setTipo] = useState<MovementType | "Todos">("Todos");

  function fmtMovement(m: (typeof movements)[0]) {
    return {
      Código: m.codigo,
      Descripción: m.descripcion,
      Categoría: m.categoria || "Sin categoría",
      Tipo: m.tipo,
      Cantidad: m.cantidad,
      "Unidad de medida": m.unidadMedida || "",
      "Costo unitario": m.costo,
      "Precio de venta": m.precioVenta,
      "Valor total": m.valor,
      Fecha: m.fecha.split("-").reverse().join("/"),
      Responsable: m.responsable,
      Área: m.area,
    };
  }

  function exportInventory() {
    exportSheet("inventario.xlsx", inventory.map((i) => ({
      Código: i.codigo,
      Descripción: i.descripcion,
      Categoría: i.categoria || "Sin categoría",
      "Cantidad Disponible": i.cantidadDisponible,
      "Unidad de medida": i.unidadMedida || "",
      "Costo unitario": i.costo.toFixed(2),
      "Precio de venta": i.precioVenta.toFixed(2),
      "Fecha Actualización": i.fechaActualizacion.split("-").reverse().join("/"),
      Responsable: i.responsable,
      Área: i.area,
    })));
  }

  function exportEntradas() {
    exportSheet("entradas.xlsx", movements.filter((m) => m.tipo === "Entrada").map(fmtMovement));
  }

  function exportSalidas() {
    exportSheet("salidas.xlsx", movements.filter((m) => m.tipo === "Salida").map(fmtMovement));
  }

  function exportByDate() {
    const filtered = movements.filter((m) => {
      const inRange = m.fecha >= from && m.fecha <= to;
      const matchTipo = tipo === "Todos" || m.tipo === tipo;
      return inRange && matchTipo;
    });
    exportSheet(`movimientos_${from}_${to}.xlsx`, filtered.map(fmtMovement));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Exportar a Excel</h1>
        <p className="text-sm text-stone-400 mt-0.5">Descarga reportes en formato .xlsx</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ExportCard
          title="Inventario actual"
          description="Exporta todos los productos con su stock disponible, valor y área."
          accent="sky"
          onExport={exportInventory}
        />
        <ExportCard
          title="Entradas"
          description="Exporta el reporte completo de todos los ingresos registrados."
          accent="emerald"
          onExport={exportEntradas}
        />
        <ExportCard
          title="Salidas"
          description="Exporta el reporte completo de todos los retiros registrados."
          accent="rose"
          onExport={exportSalidas}
        />
      </div>

      {/* Date range export */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Exportar por período</h2>
          <p className="text-xs text-stone-400 mt-0.5">Selecciona un rango de fechas y tipo de movimiento</p>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Fecha inicial</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Fecha final</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as MovementType | "Todos")} className="input">
              <option>Todos</option>
              <option>Entrada</option>
              <option>Salida</option>
            </select>
          </div>
          <button
            onClick={exportByDate}
            className="px-5 py-2 bg-stone-800 text-white text-sm font-semibold rounded-lg hover:bg-stone-900 transition-colors h-[38px] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Descargar Excel
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportCard({ title, description, accent, onExport }: { title: string; description: string; accent: "sky" | "emerald" | "rose"; onExport: () => void }) {
  const colors = {
    sky: { bg: "bg-sunken", border: "border-line", btn: "bg-stone-800 hover:bg-stone-900", icon: "text-stone-600" },
    emerald: { bg: "bg-leaf-50", border: "border-leaf-200", btn: "bg-leaf-600 hover:bg-leaf-700", icon: "text-leaf-600" },
    rose: { bg: "bg-brand-50", border: "border-brand-200", btn: "bg-brand-600 hover:bg-brand-700", icon: "text-brand-600" },
  }[accent];

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-5 flex flex-col gap-3`}>
      <div className={`w-9 h-9 rounded-lg bg-white border ${colors.border} flex items-center justify-center`}>
        <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div>
        <h3 className="font-semibold text-stone-800">{title}</h3>
        <p className="text-xs text-stone-500 mt-0.5">{description}</p>
      </div>
      <button onClick={onExport} className={`mt-auto ${colors.btn} text-white text-sm font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        Exportar
      </button>
    </div>
  );
}
