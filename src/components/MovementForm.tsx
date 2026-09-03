import { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { AREAS, DEFAULT_CATEGORIES } from "../types";
import type { MovementType, InventoryItem } from "../types";
import { processImageFile } from "../utils/image";
import CategorySelect from "./CategorySelect";

const empty = (defaultCat?: string) => ({
  codigo: "",
  descripcion: "",
  cantidad: "",
  valor: "",
  fecha: new Date().toISOString().split("T")[0],
  responsable: "",
  area: AREAS[0] as string,
  categoria: defaultCat || DEFAULT_CATEGORIES[0],
  tipo: "Entrada" as MovementType,
  imagen: "",
  motivo: "",
});

export default function MovementForm() {
  const { inventory, categories, addMovement } = useStore();
  const [form, setForm] = useState(() => empty(categories[0] || DEFAULT_CATEGORIES[0]));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCustomValor, setIsCustomValor] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Suggestions state
  const [showCodeSuggestions, setShowCodeSuggestions] = useState(false);
  const [showDescSuggestions, setShowDescSuggestions] = useState(false);

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const descContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect if current form matches an existing inventory item
  const matchedItem = inventory.find(
    (item) =>
      (form.codigo.trim() && item.codigo.toUpperCase() === form.codigo.toUpperCase().trim()) ||
      (form.descripcion.trim() && item.descripcion.toLowerCase() === form.descripcion.toLowerCase().trim())
  );

  // Close suggestion dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (codeContainerRef.current && !codeContainerRef.current.contains(event.target as Node)) {
        setShowCodeSuggestions(false);
      }
      if (descContainerRef.current && !descContainerRef.current.contains(event.target as Node)) {
        setShowDescSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectProduct(item: InventoryItem) {
    const qty = Number(form.cantidad) > 0 ? Number(form.cantidad) : 1;
    const computedValor = (qty * item.valor).toFixed(2);

    setForm((prev) => ({
      ...prev,
      codigo: item.codigo,
      descripcion: item.descripcion,
      area: item.area || prev.area,
      categoria: item.categoria || prev.categoria || categories[0] || DEFAULT_CATEGORIES[0],
      responsable: prev.responsable || item.responsable || "",
      valor: isCustomValor && prev.valor ? prev.valor : computedValor,
      imagen: item.imagen || prev.imagen || "",
    }));
    setShowCodeSuggestions(false);
    setShowDescSuggestions(false);
    setError("");
    setSuccess("");
  }

  function handleCodigoChange(value: string) {
    const upperVal = value.toUpperCase();
    setError("");
    setSuccess("");

    // Look for exact match immediately
    const found = inventory.find((i) => i.codigo.toUpperCase() === upperVal.trim());
    if (found) {
      const qty = Number(form.cantidad) > 0 ? Number(form.cantidad) : 1;
      const computedValor = (qty * found.valor).toFixed(2);
      setForm((prev) => ({
        ...prev,
        codigo: upperVal,
        descripcion: found.descripcion,
        area: found.area || prev.area,
        categoria: found.categoria || prev.categoria || categories[0] || DEFAULT_CATEGORIES[0],
        responsable: prev.responsable || found.responsable || "",
        valor: isCustomValor && prev.valor ? prev.valor : computedValor,
        imagen: found.imagen || prev.imagen || "",
      }));
    } else {
      setForm((prev) => ({ ...prev, codigo: upperVal }));
    }
    setShowCodeSuggestions(true);
  }

  function handleDescripcionChange(value: string) {
    setError("");
    setSuccess("");

    // Look for exact match
    const found = inventory.find((i) => i.descripcion.toLowerCase() === value.toLowerCase().trim());
    if (found) {
      const qty = Number(form.cantidad) > 0 ? Number(form.cantidad) : 1;
      const computedValor = (qty * found.valor).toFixed(2);
      setForm((prev) => ({
        ...prev,
        codigo: found.codigo,
        descripcion: value,
        area: found.area || prev.area,
        categoria: found.categoria || prev.categoria || categories[0] || DEFAULT_CATEGORIES[0],
        responsable: prev.responsable || found.responsable || "",
        valor: isCustomValor && prev.valor ? prev.valor : computedValor,
        imagen: found.imagen || prev.imagen || "",
      }));
    } else {
      setForm((prev) => ({ ...prev, descripcion: value }));
    }
    setShowDescSuggestions(true);
  }

  function handleCantidadChange(value: string) {
    const qty = Number(value);
    setForm((prev) => {
      let newValor = prev.valor;
      if (matchedItem && !isCustomValor && qty > 0) {
        newValor = (qty * matchedItem.valor).toFixed(2);
      }
      return { ...prev, cantidad: value, valor: newValor };
    });
    setError("");
    setSuccess("");
  }

  function handleValorChange(value: string) {
    setIsCustomValor(true);
    setForm((prev) => ({ ...prev, valor: value }));
    setError("");
    setSuccess("");
  }

  function handleSetMaxStock() {
    if (matchedItem && matchedItem.cantidadDisponible > 0) {
      const maxQty = matchedItem.cantidadDisponible;
      const computedValor = (maxQty * matchedItem.valor).toFixed(2);
      setForm((prev) => ({
        ...prev,
        cantidad: maxQty.toString(),
        valor: isCustomValor && prev.valor ? prev.valor : computedValor,
      }));
      setError("");
    }
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).");
      return;
    }

    try {
      setIsUploadingImage(true);
      const base64 = await processImageFile(file);
      setForm((prev) => ({ ...prev, imagen: base64 }));
      setError("");
    } catch (err) {
      console.error(err);
      setError("No se pudo procesar la imagen seleccionada.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function handleRemoveImage() {
    setForm((prev) => ({ ...prev, imagen: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClearProduct() {
    setForm((prev) => ({
      ...prev,
      codigo: "",
      descripcion: "",
      cantidad: "",
      valor: "",
      imagen: "",
      motivo: "",
    }));
    setIsCustomValor(false);
    setError("");
    setSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.codigo || !form.descripcion || !form.cantidad || !form.valor || !form.fecha || !form.responsable) {
      setError("Todos los campos son requeridos.");
      return;
    }

    const qty = Number(form.cantidad);
    if (isNaN(qty) || qty <= 0) {
      setError("La cantidad debe ser un número mayor a 0.");
      return;
    }

    const val = Number(form.valor);
    if (isNaN(val) || val < 0) {
      setError("El valor debe ser un número válido mayor o igual a 0.");
      return;
    }

    if (form.tipo === "Salida" && matchedItem && qty > matchedItem.cantidadDisponible) {
      setError(`Stock insuficiente. Disponible: ${matchedItem.cantidadDisponible} unidades.`);
      return;
    }

    const err = addMovement({
      codigo: form.codigo.toUpperCase().trim(),
      descripcion: form.descripcion.trim(),
      cantidad: qty,
      valor: val,
      fecha: form.fecha,
      responsable: form.responsable.trim(),
      area: form.area,
      categoria: form.categoria,
      tipo: form.tipo,
      imagen: form.imagen ? form.imagen : undefined,
      motivo: form.tipo === "Salida" && form.motivo ? form.motivo.trim() : undefined,
    });

    if (err) {
      setError(err);
    } else {
      setSuccess(`${form.tipo} de "${form.descripcion}" registrada correctamente.`);
      setForm(empty(categories[0] || DEFAULT_CATEGORIES[0]));
      setIsCustomValor(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // Filter suggestion lists
  const codeMatches = inventory.filter(
    (item) =>
      !form.codigo.trim() ||
      item.codigo.toUpperCase().includes(form.codigo.toUpperCase().trim()) ||
      item.descripcion.toLowerCase().includes(form.codigo.toLowerCase().trim())
  );

  const descMatches = inventory.filter(
    (item) =>
      !form.descripcion.trim() ||
      item.descripcion.toLowerCase().includes(form.descripcion.toLowerCase().trim()) ||
      item.codigo.toUpperCase().includes(form.descripcion.toUpperCase().trim())
  );

  const isExcessStock =
    form.tipo === "Salida" &&
    matchedItem &&
    Number(form.cantidad) > matchedItem.cantidadDisponible;

  const isZeroStock =
    form.tipo === "Salida" &&
    matchedItem &&
    matchedItem.cantidadDisponible <= 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
            Registrar Movimiento
          </h2>
        </div>
        {matchedItem && (
          <button
            type="button"
            onClick={handleClearProduct}
            className="text-xs text-stone-400 hover:text-brand-600 transition-colors flex items-center gap-1 font-medium cursor-pointer"
            title="Limpiar campos de producto"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar selección
          </button>
        )}
      </div>

      {/* Matched Product Alert / Info Card */}
      {matchedItem && (
        <div className="bg-brand-50/80 border border-brand-200/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
          <div className="flex items-start gap-2.5">
            {matchedItem.imagen ? (
              <img
                src={matchedItem.imagen}
                alt={matchedItem.descripcion}
                className="w-10 h-10 rounded-lg object-cover border border-brand-200 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center flex-shrink-0 font-mono font-bold text-xs mt-0.5 sm:mt-0">
                📦
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-brand-900 bg-brand-100 px-1.5 py-0.5 rounded text-[11px]">
                  {matchedItem.codigo}
                </span>
                <span className="font-semibold text-stone-900">{matchedItem.descripcion}</span>
                {matchedItem.categoria && (
                  <span className="text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                    {matchedItem.categoria}
                  </span>
                )}
                <span className="text-stone-500 font-normal">({matchedItem.area})</span>
              </div>
              <div className="text-stone-600 mt-1 flex items-center gap-3 flex-wrap">
                <span>
                  Stock actual:{" "}
                  <strong
                    className={
                      matchedItem.cantidadDisponible <= 0
                        ? "text-brand-600 font-bold"
                        : matchedItem.cantidadDisponible <= 5
                        ? "text-amber-600 font-bold"
                        : "text-leaf-700 font-bold"
                    }
                  >
                    {matchedItem.cantidadDisponible} un.
                  </strong>
                </span>
                <span className="text-stone-300">•</span>
                <span>
                  Precio ref: <strong className="text-stone-800">S/ {matchedItem.valor.toFixed(2)} c/u</strong>
                </span>
              </div>
            </div>
          </div>

          {form.tipo === "Salida" && matchedItem.cantidadDisponible > 0 && (
            <button
              type="button"
              onClick={handleSetMaxStock}
              className="self-start sm:self-center px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1 shadow-xs cursor-pointer"
            >
              Usar todo el stock ({matchedItem.cantidadDisponible})
            </button>
          )}
        </div>
      )}

      {/* Zero stock alert for exit */}
      {isZeroStock && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs text-brand-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span><strong>Sin existencias:</strong> Este producto tiene 0 unidades en inventario. No es posible registrar salidas.</span>
        </div>
      )}

      {/* Excess stock alert for exit */}
      {isExcessStock && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs text-brand-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Cantidad no permitida:</strong> Ingresaste {form.cantidad} unidades, pero solo hay {matchedItem.cantidadDisponible} disponibles.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Row 1: Código & Descripción */}
          {/* Código with Autocomplete */}
          <div ref={codeContainerRef} className="relative flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="codigo" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Código
              </label>
              {matchedItem && (
                <span className="text-[11px] text-leaf-600 font-medium flex items-center gap-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Existente
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="codigo"
                value={form.codigo}
                onChange={(e) => handleCodigoChange(e.target.value)}
                onFocus={() => setShowCodeSuggestions(true)}
                placeholder="Ej. A001"
                className={`input font-mono uppercase pr-8 ${matchedItem ? "border-brand-400 bg-brand-50/20" : ""}`}
                autoComplete="off"
              />
              {form.codigo && (
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, codigo: "" }));
                    setShowCodeSuggestions(true);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Code Suggestions Dropdown */}
            {showCodeSuggestions && codeMatches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-stone-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-stone-100">
                <div className="px-3 py-1.5 bg-stone-50 text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Productos existentes ({codeMatches.length})</span>
                  <span className="text-[10px] text-stone-400 lowercase">clic para autocompletar</span>
                </div>
                {codeMatches.map((item) => (
                  <button
                    key={item.codigo}
                    type="button"
                    onClick={() => selectProduct(item)}
                    className="w-full text-left px-3 py-2 hover:bg-brand-50/70 transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.imagen ? (
                        <img src={item.imagen} alt="" className="w-7 h-7 rounded object-cover border border-stone-200 flex-shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded bg-stone-100 text-stone-500 flex items-center justify-center text-xs flex-shrink-0">📦</span>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-xs font-bold text-brand-700 group-hover:text-brand-900">
                          {item.codigo}
                        </span>
                        <span className="text-xs text-stone-600 truncate">{item.descripcion}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 text-right">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          item.cantidadDisponible <= 0
                            ? "text-brand-600"
                            : item.cantidadDisponible <= 5
                            ? "text-amber-600"
                            : "text-leaf-600"
                        }`}
                      >
                        {item.cantidadDisponible} un.
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">S/ {item.valor.toFixed(2)} c/u</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Descripción with Autocomplete */}
          <div ref={descContainerRef} className="relative flex flex-col gap-1">
            <label htmlFor="descripcion" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Descripción
            </label>
            <div className="relative">
              <input
                id="descripcion"
                value={form.descripcion}
                onChange={(e) => handleDescripcionChange(e.target.value)}
                onFocus={() => setShowDescSuggestions(true)}
                placeholder="Nombre del producto"
                className={`input pr-8 ${matchedItem ? "border-brand-400 bg-brand-50/20" : ""}`}
                autoComplete="off"
              />
              {form.descripcion && (
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, descripcion: "" }));
                    setShowDescSuggestions(true);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Desc Suggestions Dropdown */}
            {showDescSuggestions && descMatches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-stone-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-stone-100">
                <div className="px-3 py-1.5 bg-stone-50 text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Productos coincidentes ({descMatches.length})</span>
                  <span className="text-[10px] text-stone-400 lowercase">clic para autocompletar</span>
                </div>
                {descMatches.map((item) => (
                  <button
                    key={item.codigo}
                    type="button"
                    onClick={() => selectProduct(item)}
                    className="w-full text-left px-3 py-2 hover:bg-brand-50/70 transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.imagen ? (
                        <img src={item.imagen} alt="" className="w-7 h-7 rounded object-cover border border-stone-200 flex-shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded bg-stone-100 text-stone-500 flex items-center justify-center text-xs flex-shrink-0">📦</span>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-stone-800 truncate group-hover:text-brand-900">
                          {item.descripcion}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-brand-700 bg-brand-50 px-1 rounded">
                            {item.codigo}
                          </span>
                          <span className="text-[10px] text-stone-400">{item.area}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 text-right">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          item.cantidadDisponible <= 0
                            ? "text-brand-600"
                            : item.cantidadDisponible <= 5
                            ? "text-amber-600"
                            : "text-leaf-600"
                        }`}
                      >
                        {item.cantidadDisponible} un.
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">S/ {item.valor.toFixed(2)} c/u</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 2: Cantidad & Valor */}
          {/* Cantidad */}
          <Field
            label="Cantidad"
            id="cantidad"
            action={
              matchedItem && (
                <span className="text-[11px] text-stone-400">
                  Disp: <strong className="text-stone-700">{matchedItem.cantidadDisponible}</strong>
                </span>
              )
            }
          >
            <div className="relative">
              <input
                id="cantidad"
                type="number"
                min="1"
                max={form.tipo === "Salida" && matchedItem ? matchedItem.cantidadDisponible : undefined}
                value={form.cantidad}
                onChange={(e) => handleCantidadChange(e.target.value)}
                placeholder="0"
                className={`input font-mono ${isExcessStock ? "border-brand-400 bg-brand-50/30 text-brand-800" : ""}`}
              />
              {matchedItem && matchedItem.cantidadDisponible > 0 && form.tipo === "Salida" && (
                <button
                  type="button"
                  onClick={handleSetMaxStock}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  title="Usar stock máximo disponible"
                >
                  MÁX
                </button>
              )}
            </div>
          </Field>

          {/* Valor */}
          <Field
            label="Valor Total (S/)"
            id="valor"
            action={
              matchedItem && (
                <span className="text-[11px] text-stone-400">
                  Ref: S/ {matchedItem.valor.toFixed(2)} c/u
                </span>
              )
            }
          >
            <div className="relative">
              <input
                id="valor"
                type="number"
                min="0"
                step="0.01"
                value={form.valor}
                onChange={(e) => handleValorChange(e.target.value)}
                placeholder="0.00"
                className="input font-mono"
              />
              {matchedItem && Number(form.cantidad) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomValor(false);
                    const qty = Number(form.cantidad);
                    setForm((prev) => ({
                      ...prev,
                      valor: (qty * matchedItem.valor).toFixed(2),
                    }));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-brand-600 hover:text-brand-800 bg-brand-50 px-1.5 py-0.5 rounded font-medium cursor-pointer"
                  title="Recalcular según precio unitario de referencia"
                >
                  Auto
                </button>
              )}
            </div>
          </Field>

          {/* Row 3: Fecha & Responsable */}
          <Field label="Fecha" id="fecha">
            <input
              id="fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => {
                setForm((f) => ({ ...f, fecha: e.target.value }));
                setError("");
              }}
              className="input"
            />
          </Field>

          <Field label="Responsable" id="responsable">
            <input
              id="responsable"
              value={form.responsable}
              onChange={(e) => {
                setForm((f) => ({ ...f, responsable: e.target.value }));
                setError("");
              }}
              placeholder="Nombre completo"
              className="input"
            />
          </Field>
        </div>

        {/* Row 4: Área, Categoría & Imagen de Producto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {/* Área */}
          <div className="flex flex-col gap-1">
            <label htmlFor="area" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Área
            </label>
            <select
              id="area"
              value={form.area}
              onChange={(e) => {
                setForm((f) => ({ ...f, area: e.target.value }));
                setError("");
              }}
              className="input"
            >
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div className="flex flex-col gap-1">
            <label htmlFor="categoria" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Categoría
            </label>
            <CategorySelect
              id="categoria"
              value={form.categoria}
              onChange={(cat) => {
                setForm((f) => ({ ...f, categoria: cat }));
                setError("");
              }}
            />
          </div>
        </div>

        {/* Motivo (solo para Salidas) */}
        {form.tipo === "Salida" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="motivo" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Motivo de salida <span className="text-stone-400 font-normal lowercase">(opcional)</span>
            </label>
            <input
              id="motivo"
              type="text"
              value={form.motivo}
              onChange={(e) => {
                setForm((f) => ({ ...f, motivo: e.target.value }));
                setError("");
              }}
              placeholder="Ej. Uso interno, Venta, Donación, Devolución..."
              className="input"
            />
          </div>
        )}

        {/* Imagen del Producto */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Imagen del producto <span className="text-stone-400 font-normal lowercase">(opcional)</span>
            </label>
            {form.imagen && (
              <button
                type="button"
                onClick={handleRemoveImage}
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
            id="producto-imagen-input"
          />

          {form.imagen ? (
            <div className="flex items-center gap-3 p-2 bg-stone-50 border border-stone-200 rounded-lg">
              <img
                src={form.imagen}
                alt="Vista previa del producto"
                className="w-12 h-12 rounded-md object-cover border border-stone-200 shadow-xs flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-stone-700 truncate">Imagen cargada</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-brand-600 hover:text-brand-800 font-medium text-left mt-0.5 cursor-pointer"
                >
                  Cambiar imagen
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="w-full py-2.5 px-3 border border-dashed border-stone-300 hover:border-brand-500 hover:bg-brand-50/50 rounded-lg text-xs text-stone-600 flex items-center justify-center gap-2 transition-all cursor-pointer bg-stone-50/50"
            >
              <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{isUploadingImage ? "Procesando imagen..." : "Subir foto / imagen del producto"}</span>
            </button>
          )}
        </div>

        {/* BOTTOM SECTION: Buttons & Actions */}
        <div className="border-t border-stone-100 pt-4 flex flex-col gap-3 mt-1">
          {/* Tipo de movimiento Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Tipo de movimiento
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["Entrada", "Salida"] as MovementType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, tipo: t }));
                    setError("");
                    setSuccess("");
                  }}
                  className={`py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    form.tipo === t
                      ? t === "Entrada"
                        ? "bg-leaf-600 text-white border-leaf-600 shadow-xs ring-2 ring-leaf-500/20"
                        : "bg-brand-600 text-white border-brand-600 shadow-xs ring-2 ring-brand-500/20"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:border-stone-300"
                  }`}
                >
                  {t === "Entrada" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  {t}
                </button>
              ))}
            </div>
            {form.tipo === "Salida" && !matchedItem && (
              <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
                <span>💡</span> Selecciona o escribe el código/descripción de un producto existente para marcar su salida.
              </p>
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={Boolean(isZeroStock || isExcessStock)}
            className={`w-full py-3 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
              isZeroStock || isExcessStock
                ? "bg-stone-300 cursor-not-allowed text-stone-500"
                : form.tipo === "Entrada"
                ? "bg-stone-900 hover:bg-stone-800 active:bg-stone-950"
                : "bg-brand-600 hover:bg-brand-700 active:bg-brand-800"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {form.tipo === "Entrada" ? "Registrar Entrada" : "Registrar Salida"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  id,
  action,
  children,
}: {
  label: string;
  id: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-stone-500 uppercase tracking-wide">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}
