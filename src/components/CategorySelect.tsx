import { useState } from "react";
import { useStore } from "../store";

interface CategorySelectProps {
  id?: string;
  value: string;
  onChange: (category: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function CategorySelect({
  id = "categoria",
  value,
  onChange,
  className = "input",
  disabled = false,
}: CategorySelectProps) {
  const { categories, addCategory } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [modalError, setModalError] = useState("");

  function handleOpenModal() {
    setNewCatName("");
    setModalError("");
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setNewCatName("");
    setModalError("");
  }

  function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setModalError("Por favor escribe un nombre para la categoría.");
      return;
    }

    const res = addCategory(trimmed);
    if (!res.success) {
      setModalError(res.message || "Error al agregar categoría.");
      return;
    }

    // Auto-select newly created category
    onChange(trimmed);
    handleCloseModal();
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={className}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          disabled={disabled}
          className="px-2.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 hover:border-brand-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs whitespace-nowrap active:scale-95 disabled:opacity-50"
          title="Crear nueva categoría"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nueva</span>
        </button>
      </div>

      {/* Modal para crear categoría */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Crear Categoría</h3>
                  <p className="text-xs text-stone-400">Añade una nueva categoría para organizar productos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-categoria-nombre" className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                  Nombre de la categoría
                </label>
                <input
                  id="modal-categoria-nombre"
                  autoFocus
                  type="text"
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setModalError("");
                  }}
                  placeholder="Ej. Limpieza y desinfección"
                  className="input"
                />
                <p className="text-[11px] text-stone-400">
                  Escribe un nombre claro. Se agregará permanentemente a la lista de categorías.
                </p>
              </div>

              {modalError && (
                <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg p-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Crear Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
