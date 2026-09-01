import { useState } from "react";
import { useStore } from "../store";
import type { Movement, InventoryItem } from "../types";
import EditProductModal from "./EditProductModal";
import EditMovementModal from "./EditMovementModal";

export default function CodeSearch() {
  const { movements, inventory, deleteProduct, deleteMovement } = useStore();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);

  const code = query.trim().toUpperCase();
  const item = inventory.find((i) => i.codigo.toUpperCase() === code);
  const history = movements.filter((m) => m.codigo.toUpperCase() === code);
  const histEntradas = history.filter((m) => m.tipo === "Entrada");
  const histSalidas = history.filter((m) => m.tipo === "Salida");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
    setConfirmDeleteProduct(false);
  }

  function handleDeleteProduct() {
    if (item) {
      deleteProduct(item.codigo);
      setConfirmDeleteProduct(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Búsqueda por Código</h1>
        <p className="text-sm text-slate-400 mt-0.5">Localiza un producto por su código único</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSearched(false); setConfirmDeleteProduct(false); }}
          placeholder="Ingrese el código (ej. A001)"
          className="input font-mono uppercase flex-1"
        />
        <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
          Buscar
        </button>
      </form>

      {searched && !item && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          No se encontró ningún producto con el código <span className="font-mono font-bold">{code}</span>.
        </div>
      )}

      {searched && item && (
        <div className="flex flex-col gap-5">
          {/* Summary card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                {item.imagen ? (
                  <img
                    src={item.imagen}
                    alt={item.descripcion}
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-xs flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center text-2xl flex-shrink-0">
                    📦
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-semibold uppercase">{item.codigo}</span>
                    <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full font-medium">
                      {item.categoria || "Sin categoría"}
                    </span>
                    <span className="text-xs text-slate-400">Área: {item.area}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{item.descripcion}</h2>
                  
                  {/* Edit and Delete product actions */}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(item)}
                      className="text-xs text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Editar producto
                    </button>

                    {confirmDeleteProduct ? (
                      <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg">
                        <span className="text-xs text-rose-700 font-medium">¿Eliminar producto y registros?</span>
                        <button
                          onClick={handleDeleteProduct}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          onClick={() => setConfirmDeleteProduct(false)}
                          className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteProduct(true)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Eliminar este producto
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 text-center">
                <div className="flex flex-col">
                  <span className={`text-2xl font-bold ${item.cantidadDisponible <= 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {item.cantidadDisponible}
                  </span>
                  <span className="text-xs text-slate-400 uppercase tracking-wide">disponible</span>
                </div>
                <div className="w-px bg-slate-100" />
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-slate-700">${item.valor.toFixed(2)}</span>
                  <span className="text-xs text-slate-400 uppercase tracking-wide">valor unit.</span>
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <HistTable
              title="Historial de Entradas"
              rows={histEntradas}
              tipo="Entrada"
              onDelete={deleteMovement}
              onEdit={(m) => setEditingMovement(m)}
            />
            <HistTable
              title="Historial de Salidas"
              rows={histSalidas}
              tipo="Salida"
              onDelete={deleteMovement}
              onEdit={(m) => setEditingMovement(m)}
            />
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
      />

      {/* Edit Movement Modal */}
      <EditMovementModal
        movement={editingMovement}
        onClose={() => setEditingMovement(null)}
      />
    </div>
  );
}

function HistTable({
  title,
  rows,
  tipo,
  onDelete,
  onEdit,
}: {
  title: string;
  rows: ReturnType<typeof useStore>["movements"];
  tipo: string;
  onDelete: (id: string) => void;
  onEdit: (m: Movement) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className={`px-4 py-3 border-b border-slate-100 flex items-center gap-2`}>
        <span className={`w-2 h-2 rounded-full ${tipo === "Entrada" ? "bg-emerald-500" : "bg-rose-500"}`} />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="ml-auto text-xs text-slate-400">{rows.length} registros</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-right px-3 py-2">Cantidad</th>
              <th className="text-right px-3 py-2">Valor</th>
              <th className="text-left px-3 py-2">Fecha</th>
              <th className="text-left px-3 py-2">Responsable</th>
              <th className="text-center px-2 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2.5 text-right font-mono text-slate-700">{r.cantidad}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">${r.valor.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-slate-500">{r.fecha.split("-").reverse().join("/")}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.responsable}</td>
                <td className="px-2 py-2.5 text-center">
                  {deletingId === r.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { onDelete(r.id); setDeletingId(null); }}
                        className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-semibold hover:bg-rose-700 cursor-pointer"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] hover:bg-slate-300 cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEdit(r)}
                        className="p-1 text-slate-300 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors cursor-pointer"
                        title="Editar registro"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingId(r.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Eliminar registro"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">Sin registros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
