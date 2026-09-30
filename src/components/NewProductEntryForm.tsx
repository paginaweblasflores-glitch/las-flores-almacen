import { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { AREAS, DEFAULT_CATEGORIES } from "../types";
import type { ProductoMaestro } from "../types";
import { filtrarBusqueda } from "../utils/search";
import ComboBox from "./ComboBox";
import Field from "./Field";
import ImageUploadField from "./ImageUploadField";

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
  const { categories, unidades, areas, addMovement, registrarProductoEnAlmacen, nextCodigo, catalogoMaestro } =
    useStore();
  const [form, setForm] = useState(() => emptyForm(categories[0] || DEFAULT_CATEGORIES[0]));
  const [autoCodigo, setAutoCodigo] = useState(true);
  const [match, setMatch] = useState<ProductoMaestro | null>(null);
  const [sugerenciasOcultas, setSugerenciasOcultas] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageFieldKey, setImageFieldKey] = useState(0);

  // Autonumeración del código mientras el usuario no lo haya editado a
  // mano. `nextCodigo` cambia de referencia cada vez que se actualiza mi
  // lista de productos (p.ej. justo después de registrar uno) — se
  // aprovecha eso para recalcular tras un `resetForm`, no solo al montar.
  useEffect(() => {
    if (!autoCodigo) return;
    setForm((f) => (f.codigo === "" ? { ...f, codigo: nextCodigo() } : f));
  }, [autoCodigo, nextCodigo]);

  // El nombre es lo que se busca (no el código: cada almacén tiene su
  // propia numeración, así que un código no dice nada sobre si el
  // producto ya existe en otro lado). Se compara contra el catálogo
  // MAESTRO completo — reusa el mismo criterio de búsqueda que el resto
  // de la app (filtrarBusqueda: todas las palabras, sin importar tildes).
  const sugerencias = useMemo(() => {
    if (match || sugerenciasOcultas) return [];
    const nombre = form.descripcion.trim();
    if (nombre.length < 3) return [];
    return filtrarBusqueda(catalogoMaestro, nombre, () => "", (p) => p.descripcion).slice(0, 5);
  }, [catalogoMaestro, form.descripcion, match, sugerenciasOcultas]);

  // Mientras hay un match confirmado, la identidad (descripción/unidad/
  // categoría/imagen) se refleja tal cual está en el catálogo maestro —
  // no se puede editar acá, para no hacer que "el mismo producto" quede
  // con dos descripciones distintas en cada almacén.
  useEffect(() => {
    if (!match) return;
    setForm((f) => ({
      ...f,
      descripcion: match.descripcion,
      unidadMedida: match.unidadMedida || f.unidadMedida,
      categoria: match.categoria || f.categoria,
      imagen: match.imagen || "",
    }));
  }, [match]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
    setSuccess("");
    if (key === "descripcion") setSugerenciasOcultas(false);
  }

  function resetForm() {
    setForm(emptyForm(categories[0] || DEFAULT_CATEGORIES[0]));
    setAutoCodigo(true);
    setMatch(null);
    setSugerenciasOcultas(false);
    setImageFieldKey((k) => k + 1); // remonta el campo de imagen, limpio
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

    setSubmitting(true);
    // Si la persona confirmó que es un producto que ya existe en el
    // catálogo maestro (match), no se crea identidad nueva — solo mi
    // código local. Si no, se crea la identidad nueva primero (tiene que
    // existir en el catálogo maestro antes del primer movimiento, por la FK).
    const { error: catalogoErr, codigo: codigoAsignado } = await registrarProductoEnAlmacen(
      match
        ? { codigo: form.codigo.toUpperCase().trim(), productoId: match.id }
        : {
            codigo: form.codigo.toUpperCase().trim(),
            nuevo: {
              descripcion: form.descripcion.trim(),
              unidadMedida: form.unidadMedida,
              categoria: form.categoria,
              imagen: form.imagen ? form.imagen : undefined,
            },
          },
    );
    if (catalogoErr || !codigoAsignado) {
      setSubmitting(false);
      setError(catalogoErr ?? "No se pudo registrar el producto.");
      return;
    }

    const err = addMovement({
      codigo: codigoAsignado,
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

    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(
        match
          ? `"${form.descripcion.trim()}" sumado a tu almacén con ${qty} de stock inicial.`
          : `Producto "${form.descripcion.trim()}" registrado con ${qty} de stock inicial.`,
      );
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

      {match && (
        <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>"{match.descripcion}"</strong> ya existe en el catálogo compartido (lo creó el otro almacén). No
            hace falta darlo de alta de nuevo — completá cantidad, costo y área, y se suma a tu almacén con esa misma
            identidad.{" "}
            <button
              type="button"
              onClick={() => {
                setMatch(null);
                setSugerenciasOcultas(true);
              }}
              className="underline font-semibold cursor-pointer"
            >
              No, es otro producto
            </button>
          </span>
        </div>
      )}

      {sugerencias.length > 0 && (
        <div className="border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-stone-500 bg-stone-50 border-b border-stone-100">
            ¿Ya existe algo parecido? (creado por el otro almacén)
          </div>
          <div className="divide-y divide-stone-100">
            {sugerencias.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex items-center gap-2">
                  {p.imagen && (
                    <img src={p.imagen} alt="" className="w-7 h-7 rounded object-cover border border-stone-200 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-stone-800 truncate">{p.descripcion}</p>
                    <p className="text-[11px] text-stone-400">
                      {p.unidadMedida || "UNID"}
                      {p.categoria ? ` · ${p.categoria}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMatch(p)}
                  className="text-xs font-semibold text-leaf-700 hover:text-leaf-800 whitespace-nowrap cursor-pointer"
                >
                  Sí, es este
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSugerenciasOcultas(true)}
            className="w-full text-center text-xs text-stone-400 hover:text-stone-600 px-3 py-2 border-t border-stone-100 cursor-pointer"
          >
            Ninguno — es un producto nuevo
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Código"
          id="np-codigo"
          action={<span className="text-stone-400 font-normal lowercase">(correlativo automático de tu almacén)</span>}
        >
          <input
            id="np-codigo"
            value={form.codigo}
            onChange={(e) => {
              setAutoCodigo(false);
              set("codigo", e.target.value.toUpperCase());
            }}
            placeholder="Ej. 100"
            className="input font-mono"
          />
        </Field>

        <Field
          label="Descripción"
          id="np-desc"
          action={
            match ? (
              <span className="text-stone-400 font-normal lowercase">(del catálogo compartido)</span>
            ) : undefined
          }
        >
          <input
            id="np-desc"
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            placeholder="Nombre del producto (escribí para buscar coincidencias)"
            disabled={Boolean(match)}
            className="input disabled:bg-stone-50 disabled:text-stone-500"
          />
        </Field>

        <Field label="Cantidad inicial" id="np-cant">
          <input
            id="np-cant"
            type="number"
            min="1"
            value={form.cantidad}
            onChange={(e) => set("cantidad", e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            className="input font-mono"
          />
        </Field>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Unidad de medida{" "}
            <span className="text-stone-400 font-normal lowercase">
              {match ? "(del catálogo compartido)" : "(elige o escribe otra)"}
            </span>
          </label>
          <div className={match ? "pointer-events-none opacity-60" : ""}>
            <ComboBox
              id="np-unidad"
              value={form.unidadMedida}
              options={unidades}
              placeholder="UNID"
              uppercase
              onChange={(v) => set("unidadMedida", v)}
            />
          </div>
        </div>

        <Field label="Costo unitario (S/)" id="np-costo">
          <input
            id="np-costo"
            type="number"
            min="0"
            step="0.01"
            value={form.costo}
            onChange={(e) => set("costo", e.target.value)}
            onFocus={(e) => e.target.select()}
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
            onFocus={(e) => e.target.select()}
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
            Categoría{" "}
            <span className="text-stone-400 font-normal lowercase">
              {match ? "(del catálogo compartido)" : "(elige o escribe otra)"}
            </span>
          </label>
          <div className={match ? "pointer-events-none opacity-60" : ""}>
            <ComboBox id="np-cat" value={form.categoria} options={categories} onChange={(v) => set("categoria", v)} />
          </div>
        </div>
      </div>

      {match ? (
        form.imagen ? (
          <div className="flex items-center gap-3">
            <img src={form.imagen} alt={form.descripcion} className="w-16 h-16 rounded-lg object-cover border border-stone-200" />
            <span className="text-xs text-stone-400">Imagen del catálogo compartido.</span>
          </div>
        ) : null
      ) : (
        <ImageUploadField
          key={imageFieldKey}
          value={form.imagen}
          onChange={(url) => set("imagen", url)}
          onError={setError}
          hint="(opcional)"
        />
      )}

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
        disabled={submitting}
        className="w-full py-3 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer bg-leaf-600 hover:bg-leaf-700 active:bg-leaf-800 disabled:bg-stone-300 disabled:cursor-not-allowed disabled:text-stone-500"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {submitting ? "Guardando…" : match ? "Agregar a mi almacén" : "Registrar producto nuevo"}
      </button>
    </form>
  );
}
