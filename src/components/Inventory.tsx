import { useState } from "react";
import { useStore } from "../store";
import type { InventoryItem } from "../types";
import EditProductModal from "./EditProductModal";

export default function Inventory() {
  const { inventory, categories, deleteProduct, clearAll } = useStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filtered = inventory.filter((i) => {
    const matchSearch =
      i.codigo.toLowerCase().includes(search.toLowerCase()) ||
      i.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      i.area.toLowerCase().includes(search.toLowerCase()) ||
      (i.categoria && i.categoria.toLowerCase().includes(search.toLowerCase()));

    const matchCategory =
      selectedCategory === "Todas" ||
      (i.categoria && i.categoria.toLowerCase() === selectedCategory.toLowerCase());

    return matchSearch && matchCategory;
  });

  function handleDeleteProduct(codigo: string) {
    deleteProduct(codigo);
    setDeletingCode(null);
  }

  function handleClearAll() {
    clearAll();
    setConfirmClearAll(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventario</h1>
          <p className="text-sm text-slate-400 mt-0.5">{inventory.length} productos registrados</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input w-full sm:w-48 bg-white"
            title="Filtrar por categoría"
          >
            <option value="Todas">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre, área..."
            className="input w-full sm:w-64"
          />

          {inventory.length > 0 && (
            confirmClearAll ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-rose-700 font-medium">¿Vaciar todo el almacén?</span>
                <button
                  onClick={handleClearAll}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Sí, vaciar
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Eliminar todos los registros del almacén"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Vaciar Almacén
              </button>
            )
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-right px-4 py-3">Disponible</th>
                <th className="text-right px-4 py-3">Valor unit.</th>
                <th className="text-left px-4 py-3">Actualizado</th>
                <th className="text-left px-4 py-3">Responsable</th>
                <th className="text-left px-4 py-3">Área</th>
                <th className="text-center px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item) => (
                <tr key={item.codigo} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-sky-700 bg-sky-50/40">{item.codigo}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    <div className="flex items-center gap-2.5">
                      {item.imagen ? (
                        <img
                          src={item.imagen}
                          alt={item.descripcion}
                          className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center text-xs flex-shrink-0">
                          📦
                        </div>
                      )}
                      <span className="truncate">{item.descripcion}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                      {item.categoria || "Sin categoría"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono font-semibold ${item.cantidadDisponible <= 0 ? "text-rose-600 font-bold" : item.cantidadDisponible <= 5 ? "text-amber-600" : "text-slate-800"}`}>
                      {item.cantidadDisponible}
                    </span>
                    {item.cantidadDisponible <= 0 ? (
                      <span className="ml-2 text-xs text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">agotado</span>
                    ) : item.cantidadDisponible <= 5 ? (
                      <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">bajo</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">S/ {item.valor.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-500">{item.fechaActualizacion.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3 text-slate-600">{item.responsable}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.area}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {deletingCode === item.codigo ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDeleteProduct(item.codigo)}
                          className="px-2 py-0.5 bg-rose-600 text-white rounded text-[11px] font-semibold hover:bg-rose-700 cursor-pointer"
                          title="Confirmar eliminación de este producto y sus registros"
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => setDeletingCode(null)}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] hover:bg-slate-300 cursor-pointer"
                          title="Cancelar"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingProduct(item)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Editar producto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingCode(item.codigo)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Eliminar producto y todos sus movimientos"
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
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">No se encontraron productos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
      />
    </div>
  );
}

