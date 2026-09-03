import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { InventoryItem } from "../types";
import EditProductModal from "./EditProductModal";
import Pager from "./Pager";

const PAGE_SIZE = 25;

export default function Inventory() {
  const { inventory, categories, deleteProduct, clearAll } = useStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory]);

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

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleDeleteProduct(codigo: string) {
    deleteProduct(codigo);
    setDeletingCode(null);
  }

  function handleClearAll() {
    clearAll();
    setDangerOpen(false);
    setClearConfirmText("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Inventario</h1>
          <p className="text-sm text-stone-400 mt-0.5">{inventory.length} productos registrados</p>
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
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-right px-4 py-3">Disponible</th>
                <th className="text-right px-4 py-3">Mín.</th>
                <th className="text-left px-4 py-3">Unidad</th>
                <th className="text-right px-4 py-3">Costo unit.</th>
                <th className="text-right px-4 py-3">P. venta</th>
                <th className="text-left px-4 py-3">Actualizado</th>
                <th className="text-left px-4 py-3">Área</th>
                <th className="text-center px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {pageItems.map((item) => (
                <tr key={item.codigo} className="hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700 bg-brand-50/40">{item.codigo}</td>
                  <td className="px-4 py-3 text-stone-800 font-medium">
                    <div className="flex items-center gap-2.5">
                      {item.imagen ? (
                        <img
                          src={item.imagen}
                          alt={item.descripcion}
                          className="w-8 h-8 rounded-md object-cover border border-stone-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-stone-100 text-stone-400 flex items-center justify-center text-xs flex-shrink-0">
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
                    <span className={`font-mono font-semibold ${item.cantidadDisponible <= 0 ? "text-brand-600 font-bold" : (item.stockMinimo > 0 && item.cantidadDisponible <= item.stockMinimo) ? "text-amber-600" : "text-stone-800"}`}>
                      {item.cantidadDisponible}
                    </span>
                    {item.cantidadDisponible <= 0 ? (
                      <span className="ml-2 text-xs text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">agotado</span>
                    ) : item.stockMinimo > 0 && item.cantidadDisponible <= item.stockMinimo ? (
                      <span className="ml-2 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">reponer</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-stone-400">{item.stockMinimo > 0 ? item.stockMinimo : "—"}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{item.unidadMedida || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-stone-600">S/ {item.costo.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-stone-800">S/ {item.precioVenta.toFixed(2)}</td>
                  <td className="px-4 py-3 text-stone-500">{item.fechaActualizacion.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{item.area}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {deletingCode === item.codigo ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDeleteProduct(item.codigo)}
                          className="px-2 py-0.5 bg-brand-600 text-white rounded text-[11px] font-semibold hover:bg-brand-700 cursor-pointer"
                          title="Confirmar eliminación de este producto y sus registros"
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => setDeletingCode(null)}
                          className="px-2 py-0.5 bg-stone-200 text-stone-700 rounded text-[11px] hover:bg-stone-300 cursor-pointer"
                          title="Cancelar"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingProduct(item)}
                          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Editar producto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingCode(item.codigo)}
                          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
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
                <tr><td colSpan={11} className="px-4 py-8 text-center text-stone-400 text-sm">No se encontraron productos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
      </div>

      {/* Zona de peligro — vaciar almacén */}
      {inventory.length > 0 && (
        <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          {!dangerOpen ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-brand-800">Vaciar todo el almacén</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Borra los {inventory.length} productos y todos sus movimientos. No se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => setDangerOpen(true)}
                className="px-3 py-2 border border-brand-300 text-brand-700 hover:bg-brand-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Vaciar almacén…
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-sm font-semibold text-brand-800">
                Escribe <span className="font-mono bg-white border border-brand-200 px-1.5 py-0.5 rounded">VACIAR</span> para confirmar
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  autoFocus
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="VACIAR"
                  className="input w-40 font-mono uppercase"
                />
                <button
                  onClick={handleClearAll}
                  disabled={clearConfirmText.trim().toUpperCase() !== "VACIAR"}
                  className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Vaciar definitivamente
                </button>
                <button
                  onClick={() => {
                    setDangerOpen(false);
                    setClearConfirmText("");
                  }}
                  className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
      />
    </div>
  );
}
