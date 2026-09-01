import { useState } from "react";
import { useStore } from "../store";
import type { Movement } from "../types";
import MovementForm from "./MovementForm";
import EditMovementModal from "./EditMovementModal";

function KPICard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-1 shadow-xs">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const { movements, inventory, deleteMovement } = useStore();
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const totalProducts = inventory.length;
  const totalUnits = inventory.reduce((s, i) => s + i.cantidadDisponible, 0);
  const totalEntradas = movements.filter((m) => m.tipo === "Entrada").length;
  const totalSalidas = movements.filter((m) => m.tipo === "Salida").length;
  const todayMoves = movements.filter((m) => m.fecha === today).length;

  function handleDelete(id: string) {
    deleteMovement(id);
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel Principal</h1>
        <p className="text-sm text-slate-400 mt-0.5">Registro y control de movimientos de almacén</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Productos" value={totalProducts} sub="registrados" />
        <KPICard label="Unidades" value={totalUnits.toLocaleString()} sub="disponibles" />
        <KPICard label="Entradas" value={totalEntradas} sub="registros" accent="text-emerald-600" />
        <KPICard label="Salidas" value={totalSalidas} sub="registros" accent="text-rose-500" />
        <KPICard label="Hoy" value={todayMoves} sub={`movimientos (${today.split("-").reverse().join("/")})`} accent="text-sky-600" />
      </div>

      {/* Movement Form */}
      <MovementForm />

      {/* Recent movements table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Últimos movimientos</h2>
          <span className="text-xs text-slate-400">Mostrando los últimos 8 registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Código</th>
                <th className="text-left px-4 py-2.5">Producto</th>
                <th className="text-left px-4 py-2.5">Tipo</th>
                <th className="text-right px-4 py-2.5">Cantidad</th>
                <th className="text-right px-4 py-2.5">Valor</th>
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-left px-4 py-2.5">Responsable</th>
                <th className="text-center px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...movements].reverse().slice(0, 8).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{m.codigo}</td>
                  <td className="px-4 py-2.5 text-slate-800 font-medium">
                    <div className="flex items-center gap-2.5">
                      {m.imagen ? (
                        <img
                          src={m.imagen}
                          alt={m.descripcion}
                          className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center text-xs flex-shrink-0">
                          📦
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{m.descripcion}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.5 rounded font-medium">
                            {m.categoria || "Sin categoría"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-normal">• {m.area}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${m.tipo === "Entrada" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">{m.cantidad}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">${m.valor.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.fecha.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-2.5 text-slate-600">{m.responsable}</td>
                  <td className="px-4 py-2.5 text-center">
                    {deletingId === m.id ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="px-2 py-0.5 bg-rose-600 text-white rounded text-[11px] font-semibold hover:bg-rose-700 cursor-pointer"
                          title="Confirmar eliminación"
                        >
                          Sí, borrar
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] hover:bg-slate-300 cursor-pointer"
                          title="Cancelar"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingMovement(m)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Editar movimiento"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingId(m.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Eliminar movimiento"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No hay movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Movement Modal */}
      <EditMovementModal
        movement={editingMovement}
        onClose={() => setEditingMovement(null)}
      />
    </div>
  );
}
