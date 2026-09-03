import { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { AREAS, DEFAULT_CATEGORIES, UNIDADES_MEDIDA } from "../types";
import type { Movement, MovementType } from "../types";
import { uploadProductImage } from "../utils/storage";
import CategorySelect from "./CategorySelect";

interface Props {
  movement: Movement | null;
  onClose: () => void;
}

export default function EditMovementModal({ movement, onClose }: Props) {
  const { categories, updateMovement } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    codigo: "",
    descripcion: "",
    cantidad: "",
    unidadMedida: "UNID" as string,
    costo: "",
    precioVenta: "",
    fecha: "",
    responsable: "",
    area: AREAS[0] as string,
    categoria: categories[0] || DEFAULT_CATEGORIES[0],
    tipo: "Entrada" as MovementType,
    imagen: "",
  });
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (movement) {
      setForm({
        codigo: movement.codigo,
        descripcion: movement.descripcion,
        cantidad: movement.cantidad.toString(),
        unidadMedida: movement.unidadMedida || "UNID",
        costo: movement.costo ? movement.costo.toString() : "",
        precioVenta: movement.precioVenta ? movement.precioVenta.toString() : "",
        fecha: movement.fecha,
        responsable: movement.responsable,
        area: movement.area,
        categoria: movement.categoria || categories[0] || DEFAULT_CATEGORIES[0],
        tipo: movement.tipo,
        imagen: movement.imagen || "",
      });
      setError("");
    }
  }, [movement, categories]);

  if (!movement) return null;

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen válido.");
      return;
    }

    try {
      setIsUploading(true);
      const imagenUrl = await uploadProductImage(file);
      setForm((prev) => ({ ...prev, imagen: imagenUrl }));
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
    if (!form.codigo || !form.descripcion || !form.cantidad || !form.costo || !form.fecha || !form.responsable) {
      setError("Completa código, descripción, cantidad, costo, fecha y responsable.");
      return;
    }

    const qty = Number(form.cantidad);
    if (isNaN(qty) || qty <= 0) {
      setError("La cantidad debe ser un número mayor a 0.");
      return;
    }

    const costo = Number(form.costo);
    if (isNaN(costo) || costo < 0) {
      setError("El costo debe ser un número válido mayor o igual a 0.");
      return;
    }

    const precioVenta = form.precioVenta ? Number(form.precioVenta) : costo;
    if (isNaN(precioVenta) || precioVenta < 0) {
      setError("El precio de venta debe ser un número válido mayor o igual a 0.");
      return;
    }

    const err = updateMovement(movement!.id, {
      codigo: form.codigo.toUpperCase().trim(),
      descripcion: form.descripcion.trim(),
      cantidad: qty,
      unidadMedida: form.unidadMedida,
      costo,
      precioVenta,
      fecha: form.fecha,
      responsable: form.responsable.trim(),
      area: form.area,
      categoria: form.categoria,
      tipo: form.tipo,
      imagen: form.imagen ? form.imagen : undefined,
    });

    if (err) {
      setError(err);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 flex flex-col gap-4 my-8 animate-in fade-in duration-150">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Editar Movimiento</h2>
              <p className="text-xs text-stone-400">Modifica los datos del registro</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Código</label>
              <input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                className="input font-mono uppercase"
                required
              />
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Descripción</label>
              <input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="input"
                required
              />
            </div>

            {/* Cantidad */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Cantidad</label>
              <input
                type="number"
                min="1"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                className="input font-mono"
                required
              />
            </div>

            {/* Unidad de medida */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Unidad de medida</label>
              <select
                value={form.unidadMedida}
                onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
                className="input"
              >
                {UNIDADES_MEDIDA.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Costo unitario */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Costo unitario (S/)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: e.target.value })}
                className="input font-mono"
                required
              />
            </div>

            {/* Precio de venta */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Precio de venta (S/)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precioVenta}
                onChange={(e) => setForm({ ...form, precioVenta: e.target.value })}
                className="input font-mono"
              />
            </div>

            {/* Fecha */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="input"
                required
              />
            </div>

            {/* Responsable */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Responsable</label>
              <input
                value={form.responsable}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Área */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Área</label>
              <select
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="input"
              >
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Categoría */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Categoría</label>
              <CategorySelect
                id="edit-mov-categoria"
                value={form.categoria}
                onChange={(cat) => setForm({ ...form, categoria: cat })}
              />
            </div>
          </div>

          {/* Tipo de movimiento */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tipo de movimiento</label>
            <div className="grid grid-cols-2 gap-2 mt-0.5">
              {(["Entrada", "Salida"] as MovementType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    form.tipo === t
                      ? t === "Entrada"
                        ? "bg-leaf-600 text-white border-leaf-600 shadow-xs"
                        : "bg-brand-600 text-white border-brand-600 shadow-xs"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Imagen */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Imagen del producto</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {form.imagen ? (
              <div className="flex items-center gap-3 p-2 bg-stone-50 border border-stone-200 rounded-lg">
                <img
                  src={form.imagen}
                  alt="Vista previa"
                  className="w-12 h-12 rounded-md object-cover border border-stone-200 flex-shrink-0"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium cursor-pointer"
                  >
                    Cambiar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imagen: "" })}
                    className="text-xs text-brand-500 hover:text-brand-700 font-medium cursor-pointer"
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
                className="w-full py-2.5 px-3 border border-dashed border-stone-300 hover:border-brand-500 rounded-lg text-xs text-stone-600 flex items-center justify-center gap-2 cursor-pointer bg-stone-50/50"
              >
                <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{isUploading ? "Procesando imagen..." : "Subir nueva foto"}</span>
              </button>
            )}
          </div>

          {error && (
            <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg p-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
