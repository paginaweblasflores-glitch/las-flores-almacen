import { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { AREAS, DEFAULT_CATEGORIES } from "../types";
import type { InventoryItem } from "../types";
import { processImageFile } from "../utils/image";
import CategorySelect from "./CategorySelect";

interface Props {
  product: InventoryItem | null;
  onClose: () => void;
}

export default function EditProductModal({ product, onClose }: Props) {
  const { categories, updateProduct } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [categoria, setCategoria] = useState<string>(categories[0] || DEFAULT_CATEGORIES[0]);
  const [imagen, setImagen] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (product) {
      setCodigo(product.codigo);
      setDescripcion(product.descripcion);
      setArea(product.area || AREAS[0]);
      setCategoria(product.categoria || categories[0] || DEFAULT_CATEGORIES[0]);
      setImagen(product.imagen || "");
      setError("");
    }
  }, [product, categories]);

  if (!product) return null;

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen válido.");
      return;
    }

    try {
      setIsUploading(true);
      const base64 = await processImageFile(file);
      setImagen(base64);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al procesar la imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim() || !descripcion.trim()) {
      setError("El código y la descripción son obligatorios.");
      return;
    }

    updateProduct(product!.codigo, {
      codigo: codigo.toUpperCase().trim(),
      descripcion: descripcion.trim(),
      area,
      categoria,
      imagen,
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 my-8 animate-in fade-in duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Editar Producto</h2>
              <p className="text-xs text-slate-400">Actualiza la información del producto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Código */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Código</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              className="input font-mono uppercase"
              required
            />
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Descripción</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="input"
              required
            />
          </div>

          {/* Área y Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Área */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Área</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="input"
              >
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Categoría */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Categoría</label>
              <CategorySelect
                id="edit-prod-categoria"
                value={categoria}
                onChange={(cat) => setCategoria(cat)}
              />
            </div>
          </div>

          {/* Imagen */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Imagen del producto</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagen ? (
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <img
                  src={imagen}
                  alt="Vista previa"
                  className="w-14 h-14 rounded-md object-cover border border-slate-200 flex-shrink-0"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-sky-600 hover:text-sky-800 font-medium cursor-pointer"
                  >
                    Cambiar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setImagen("")}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium cursor-pointer"
                  >
                    Quitar foto
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-sky-500 rounded-lg text-xs text-slate-600 flex items-center justify-center gap-2 cursor-pointer bg-slate-50/50"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{isUploading ? "Procesando..." : "Subir foto del producto"}</span>
              </button>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Actualizar Producto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

