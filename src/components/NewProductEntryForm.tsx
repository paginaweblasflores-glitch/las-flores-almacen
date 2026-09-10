import { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { AREAS, DEFAULT_CATEGORIES } from "../types";
import { uploadProductImage } from "../utils/storage";
import { normalizar } from "../utils/search";
import ComboBox from "./ComboBox";
import Field from "./Field";

const emptyForm = (defaultCat?: string) => ({
  codigo: "",
  descripcion: "",
  cantidad: "",
  unidadMedida: "UNID" as string,
  costo: "",
  stockMinimo: "",
  fecha: new Date().toISOString().split("T")[0],
  area: AREAS[0] as string,
  categoria: defaultCat || DEFAULT_CATEGORIES[0],
  imagen: "",
});

export default function NewProductEntryForm() {
  const { inventory, categories, unidades, areas, addMovement, nextCodigo } = useStore();
  const [form, setForm] = useState(() => emptyForm(categories[0] || DEFAULT_CATEGORIES[0]));
  const [autoCodigo, setAutoCodigo] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autonumeración del código mientras el usuario no lo haya editado a mano.
  useEffect(() => {
    if (!autoCodigo) return;
    setForm((f) => (f.codigo === "" ? { ...f, codigo: nextCodigo() } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCodigo]);

  const codigoExistente =
    form.codigo.trim() !== "" &&
    inventory.find((i) => normalizar(i.codigo) === normalizar(form.codigo));

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
    setSuccess("");
  }

  async function procesarImagen(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen válido (JPG, PNG, WebP).");
      return;
    }
    try {
      setIsUploadingImage(true);
      const url = await uploadProductImage(file);
      set("imagen", url);
    } catch (err) {
      console.error(err);
      setError("No se pudo procesar la imagen seleccionada.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    void procesarImagen(e.target.files?.[0]);
  }

  function handleImageDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (isUploadingImage) return;
    void procesarImagen(e.dataTransfer.files?.[0]);
  }

  function resetForm() {
    setForm(emptyForm(categories[0] || DEFAULT_CATEGORIES[0]));
    setAutoCodigo(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (codigoExistente) {
      setError("Ese código ya existe. Registra su entrada desde el carrito de arriba.");
      return;
    }

    const faltantes: string[] = [];
    if (!form.codigo) faltantes.push("código");
    if (!form.descripcion) faltantes.push("descripción");
    if (!form.cantidad) faltantes.push("cantidad");
    if (!form.costo) faltantes.push("costo");
    if (!form.fecha) faltantes.push("fecha");
    if (faltantes.length > 0) {
      setError(`Falta completar: ${faltantes.join(", ")}.`);
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

    const err = addMovement({
      codigo: form.codigo.toUpperCase().trim(),
      descripcion: form.descripcion.trim(),
      cantidad: qty,
      unidadMedida: form.unidadMedida,
      costo,
      stockMinimo: form.stockMinimo === "" ? undefined : Number(form.stockMinimo),
      fecha: form.fecha,
      responsable: "Almacén",
      area: form.area,
      categoria: form.categoria,
      tipo: "Entrada",
      imagen: form.imagen ? form.imagen : undefined,
    });

    if (err) {
      setError(err);
    } else {
      setSuccess(`Producto "${form.descripcion.trim()}" registrado con ${qty} de stock inicial.`);
      resetForm();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="no-print bg-white border border-stone-200 rounded-xl p-5 sm:p-6 flex flex-col gap-4 shadow-xs"
    >
      <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-leaf-500" />
        <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Registrar producto nuevo</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Código"
          id="np-codigo"
          action={
            codigoExistente ? (
              <span className="text-brand-600 font-medium lowercase">(ya existe)</span>
            ) : (
              <span className="text-stone-400 font-normal lowercase">(correlativo automático)</span>
            )
          }
        >
          <input
            id="np-codigo"
            value={form.codigo}
            onChange={(e) => {
              setAutoCodigo(false);
              set("codigo", e.target.value.toUpperCase());
            }}
            placeholder="Ej. 100"
            className={`input font-mono ${codigoExistente ? "border-brand-400 bg-brand-50/40" : ""}`}
          />
        </Field>

        <Field label="Descripción" id="np-desc">
          <input
            id="np-desc"
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            placeholder="Nombre del producto"
            className="input"
          />
        </Field>

        <Field label="Cantidad inicial" id="np-cant">
          <input
            id="np-cant"
            type="number"
            min="1"
            value={form.cantidad}
            onChange={(e) => set("cantidad", e.target.value)}
            placeholder="0"
            className="input font-mono"
          />
        </Field>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Unidad de medida <span className="text-stone-400 font-normal lowercase">(elige o escribe otra)</span>
          </label>
          <ComboBox
            id="np-unidad"
            value={form.unidadMedida}
            options={unidades}
            placeholder="UNID"
            uppercase
            onChange={(v) => set("unidadMedida", v)}
          />
        </div>

        <Field label="Costo unitario (S/)" id="np-costo">
          <input
            id="np-costo"
            type="number"
            min="0"
            step="0.01"
            value={form.costo}
            onChange={(e) => set("costo", e.target.value)}
            placeholder="0.00"
            className="input font-mono"
          />
        </Field>

        <Field label="Stock mínimo" id="np-min" action={<span className="text-stone-400 font-normal lowercase">(opcional)</span>}>
          <input
            id="np-min"
            type="number"
            min="0"
            value={form.stockMinimo}
            onChange={(e) => set("stockMinimo", e.target.value)}
            placeholder="0"
            className="input font-mono"
          />
        </Field>

        <Field label="Fecha" id="np-fecha">
          <input
            id="np-fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
            className="input"
          />
        </Field>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Área <span className="text-stone-400 font-normal lowercase">(elige o escribe otra)</span>
          </label>
          <ComboBox id="np-area" value={form.area} options={areas} onChange={(v) => set("area", v)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Categoría <span className="text-stone-400 font-normal lowercase">(elige o escribe otra)</span>
          </label>
          <ComboBox id="np-cat" value={form.categoria} options={categories} onChange={(v) => set("categoria", v)} />
        </div>
      </div>

      {/* Imagen */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Imagen del producto <span className="text-stone-400 font-normal lowercase">(opcional)</span>
          </label>
          {form.imagen && (
            <button
              type="button"
              onClick={() => {
                set("imagen", "");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-[11px] text-brand-500 hover:text-brand-700 font-medium cursor-pointer"
            >
              Quitar foto
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFileChange}
          className="hidden"
        />
        {form.imagen ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleImageDrop}
            className={`flex items-center gap-3 p-2 border rounded-lg transition-colors ${
              dragOver ? "border-brand-500 bg-brand-50/60" : "bg-stone-50 border-stone-200"
            }`}
          >
            <img
              src={form.imagen}
              alt="Vista previa del producto"
              className="w-12 h-12 rounded-md object-cover border border-stone-200 shadow-xs flex-shrink-0"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-brand-600 hover:text-brand-800 font-medium cursor-pointer"
            >
              Cambiar imagen
            </button>
            <span className="text-[11px] text-stone-400 ml-auto hidden sm:block">o arrastra otra aquí</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleImageDrop}
            disabled={isUploadingImage}
            className={`w-full py-3 px-3 border border-dashed rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              dragOver
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-stone-300 hover:border-brand-500 hover:bg-brand-50/50 text-stone-600 bg-stone-50/50"
            }`}
          >
            <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              {isUploadingImage
                ? "Subiendo imagen..."
                : dragOver
                ? "Suelta la imagen para subirla"
                : "Subir foto o arrastra la imagen aquí"}
            </span>
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="text-xs text-leaf-800 bg-leaf-50 border border-leaf-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-leaf-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={Boolean(codigoExistente)}
        className="w-full py-3 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer bg-leaf-600 hover:bg-leaf-700 active:bg-leaf-800 disabled:bg-stone-300 disabled:cursor-not-allowed disabled:text-stone-500"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Registrar producto nuevo
      </button>
    </form>
  );
}
