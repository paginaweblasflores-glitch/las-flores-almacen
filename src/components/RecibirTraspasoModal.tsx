import { useState } from "react";
import { useStore, etiquetaTraspaso } from "../store";
import type { Traspaso } from "../types";
import { AREAS, DEFAULT_CATEGORIES } from "../types";
import { cuentaPorAlmacen } from "../supabaseClient";
import { normalizar, filtrarBusqueda } from "../utils/search";
import ComboBox from "./ComboBox";

const todayISO = () => new Date().toISOString().split("T")[0];

interface LineaState {
  codigoOrigen: string;
  descripcionOrigen: string;
  unidadOrigen?: string;
  modo: "buscar" | "nuevo";
  search: string;
  productoElegidoCodigo: string | null; // código (MAYÚS/trim) de MI inventario, si ya se matcheó
  cantidad: string;
  nuevoCodigo: string;
  nuevoUnidad: string;
  nuevoCosto: string;
  nuevoArea: string;
  nuevoCategoria: string;
}

export default function RecibirTraspasoModal({ traspaso, onClose }: { traspaso: Traspaso; onClose: () => void }) {
  const { inventory, areas, categories, unidades, nextCodigo, recibirTraspaso, cancelarTraspaso } = useStore();
  const origenNombre = cuentaPorAlmacen(traspaso.almacenOrigen)?.nombre ?? traspaso.almacenOrigen;

  const [lineas, setLineas] = useState<LineaState[]>(() =>
    traspaso.items.map((it) => ({
      codigoOrigen: it.codigo,
      descripcionOrigen: it.descripcion,
      unidadOrigen: it.unidadMedida,
      modo: "buscar",
      search: it.descripcion,
      productoElegidoCodigo: null,
      cantidad: String(it.cantidad),
      nuevoCodigo: "",
      nuevoUnidad: it.unidadMedida || "UNID",
      nuevoCosto: it.costo ? String(it.costo) : "",
      nuevoArea: areas[0] ?? AREAS[0],
      nuevoCategoria: it.categoria || categories[0] || DEFAULT_CATEGORIES[0],
    })),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [error, setError] = useState("");
  const [recibiendo, setRecibiendo] = useState(false);
  const [rechazoAbierto, setRechazoAbierto] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);

  function updateLinea(idx: number, patch: Partial<LineaState>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setError("");
  }

  function siguienteCodigoDisponible(): string {
    const usados = new Set(
      lineas.filter((l) => l.modo === "nuevo" && l.nuevoCodigo).map((l) => l.nuevoCodigo.toUpperCase().trim()),
    );
    let n = Number(nextCodigo());
    while (usados.has(String(n)) || inventory.some((i) => i.codigo.toUpperCase().trim() === String(n))) {
      n++;
    }
    return String(n);
  }

  function elegirExistente(idx: number, codigo: string, descripcion: string) {
    updateLinea(idx, { productoElegidoCodigo: codigo.toUpperCase().trim(), search: descripcion });
    setOpenIndex(null);
  }

  function pasarANuevo(idx: number) {
    updateLinea(idx, { modo: "nuevo", productoElegidoCodigo: null, nuevoCodigo: siguienteCodigoDisponible() });
    setOpenIndex(null);
  }

  function volverABuscar(idx: number) {
    updateLinea(idx, { modo: "buscar", productoElegidoCodigo: null });
  }

  type Resuelto = {
    codigoOrigen: string;
    codigo: string;
    descripcion: string;
    cantidad: number;
    unidadMedida?: string;
    costo: number;
    categoria?: string;
    area: string;
    esNuevo: boolean;
  };

  function construirResueltos(): { resueltos: Resuelto[] } | { error: string } {
    const usadosNuevos = new Set<string>();
    const resueltos: Resuelto[] = [];
    for (const l of lineas) {
      const cant = Math.floor(Number(l.cantidad));
      if (!cant || cant <= 0) return { error: `Cantidad inválida para "${l.descripcionOrigen}".` };

      if (l.modo === "buscar") {
        if (!l.productoElegidoCodigo) {
          return { error: `Falta resolver "${l.descripcionOrigen}": búscalo en tu inventario o créalo como nuevo.` };
        }
        const prod = inventory.find((i) => i.codigo.toUpperCase().trim() === l.productoElegidoCodigo);
        if (!prod) return { error: `El producto elegido para "${l.descripcionOrigen}" ya no existe. Vuelve a elegirlo.` };
        resueltos.push({
          codigoOrigen: l.codigoOrigen,
          codigo: prod.codigo,
          descripcion: prod.descripcion,
          cantidad: cant,
          unidadMedida: prod.unidadMedida,
          costo: prod.costo,
          categoria: prod.categoria,
          area: prod.area,
          esNuevo: false,
        });
      } else {
        const codigoNorm = l.nuevoCodigo.toUpperCase().trim();
        if (!codigoNorm) return { error: `Falta el código nuevo para "${l.descripcionOrigen}".` };
        if (inventory.some((i) => i.codigo.toUpperCase().trim() === codigoNorm) || usadosNuevos.has(codigoNorm)) {
          return { error: `El código "${codigoNorm}" ya está en uso. Elige otro para "${l.descripcionOrigen}".` };
        }
        const costo = Number(l.nuevoCosto);
        if (l.nuevoCosto === "" || isNaN(costo) || costo < 0) {
          return { error: `Costo inválido para "${l.descripcionOrigen}".` };
        }
        if (!l.nuevoArea) return { error: `Falta el área para "${l.descripcionOrigen}".` };
        usadosNuevos.add(codigoNorm);
        resueltos.push({
          codigoOrigen: l.codigoOrigen,
          codigo: codigoNorm,
          descripcion: l.descripcionOrigen,
          cantidad: cant,
          unidadMedida: l.nuevoUnidad || "UNID",
          costo,
          categoria: l.nuevoCategoria,
          area: l.nuevoArea,
          esNuevo: true,
        });
      }
    }
    return { resueltos };
  }

  async function handleConfirmar() {
    if (!responsable.trim()) {
      setError("Falta el responsable de la recepción.");
      return;
    }
    const res = construirResueltos();
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setRecibiendo(true);
    const err = await recibirTraspaso(traspaso.id, res.resueltos, responsable, fecha);
    setRecibiendo(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  async function handleRechazar() {
    if (!motivoRechazo.trim()) {
      setError("Escribe un motivo para rechazar el traspaso.");
      return;
    }
    setRechazando(true);
    const err = await cancelarTraspaso(traspaso.id, motivoRechazo);
    setRechazando(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  const ocupado = recibiendo || rechazando;

  return (
    <div className="no-print fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-5 flex flex-col gap-4 my-8">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Recibir traspaso {etiquetaTraspaso(traspaso)}</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              De {origenNombre} · enviado el {traspaso.fechaEnvio.split("-").reverse().join("/")} por{" "}
              {traspaso.responsableEnvio}
              {traspaso.motivo ? ` · ${traspaso.motivo}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={ocupado}
            aria-label="Cerrar"
            className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {lineas.map((l, idx) => {
            const results =
              l.modo === "buscar" && openIndex === idx
                ? filtrarBusqueda(inventory, l.search, (i) => i.codigo, (i) => i.descripcion).slice(0, 15)
                : [];
            const productoElegido = l.productoElegidoCodigo
              ? inventory.find((i) => i.codigo.toUpperCase().trim() === l.productoElegidoCodigo)
              : undefined;
            const nuevoCodigoExistente =
              l.nuevoCodigo.trim() !== "" && inventory.some((i) => normalizar(i.codigo) === normalizar(l.nuevoCodigo));

            return (
              <div key={l.codigoOrigen} className="border border-stone-200 rounded-lg p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-stone-800 truncate">
                    <span className="font-mono text-xs text-brand-700 mr-1.5">{l.codigoOrigen}</span>
                    {l.descripcionOrigen}
                  </span>
                  <span className="text-xs text-stone-400 flex-shrink-0">
                    Enviado: {traspaso.items.find((it) => it.codigo === l.codigoOrigen)?.cantidad} {l.unidadOrigen || "UNID"}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="w-28 flex-shrink-0">
                    <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Cantidad a recibir</label>
                    <input
                      type="number"
                      min="1"
                      value={l.cantidad}
                      onChange={(e) => updateLinea(idx, { cantidad: e.target.value })}
                      className="input font-mono mt-0.5"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {l.modo === "buscar" ? (
                      <>
                        <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                          Producto en mi inventario
                        </label>
                        {productoElegido ? (
                          <div className="mt-0.5 flex items-center justify-between gap-2 border border-leaf-200 bg-leaf-50 rounded-lg px-3 py-2">
                            <span className="text-sm text-stone-800 truncate">
                              <span className="font-mono text-xs text-leaf-700 mr-1.5">{productoElegido.codigo}</span>
                              {productoElegido.descripcion}
                              <span className="text-stone-400 ml-1.5">(stock: {productoElegido.cantidadDisponible})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => updateLinea(idx, { productoElegidoCodigo: null })}
                              className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex-shrink-0 cursor-pointer"
                            >
                              Cambiar
                            </button>
                          </div>
                        ) : (
                          <div className="relative mt-0.5">
                            <input
                              value={l.search}
                              onChange={(e) => updateLinea(idx, { search: e.target.value })}
                              onFocus={() => setOpenIndex(idx)}
                              onBlur={() => setTimeout(() => setOpenIndex((cur) => (cur === idx ? null : cur)), 150)}
                              placeholder="Buscar por código o nombre…"
                              className="input"
                              autoComplete="off"
                            />
                            {openIndex === idx && (
                              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                                {results.map((item) => (
                                  <button
                                    key={item.codigo}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => elegirExistente(idx, item.codigo, item.descripcion)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50 border-b border-stone-50 last:border-0 cursor-pointer"
                                  >
                                    <span className="truncate">
                                      <span className="font-mono text-xs text-brand-700 mr-1.5">{item.codigo}</span>
                                      {item.descripcion}
                                    </span>
                                    <span className="text-xs text-stone-400 flex-shrink-0">Stock: {item.cantidadDisponible}</span>
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => pasarANuevo(idx)}
                                  className="w-full px-3 py-2 text-left text-sm text-leaf-700 hover:bg-leaf-50 font-medium cursor-pointer"
                                >
                                  + No está en mi inventario — crear como producto nuevo
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                          Producto nuevo en mi inventario
                        </span>
                        <button
                          type="button"
                          onClick={() => volverABuscar(idx)}
                          className="text-xs font-semibold text-stone-500 hover:text-stone-800 cursor-pointer"
                        >
                          Buscar existente
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {l.modo === "nuevo" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Código</label>
                      <input
                        value={l.nuevoCodigo}
                        onChange={(e) => updateLinea(idx, { nuevoCodigo: e.target.value.toUpperCase() })}
                        className={`input font-mono text-sm ${nuevoCodigoExistente ? "border-brand-400 bg-brand-50/40" : ""}`}
                      />
                      {nuevoCodigoExistente && <span className="text-[10px] text-brand-600">Ya existe</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Unidad</label>
                      <ComboBox
                        value={l.nuevoUnidad}
                        options={unidades}
                        onChange={(v) => updateLinea(idx, { nuevoUnidad: v })}
                        placeholder="UNID"
                        uppercase
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Costo (S/)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.nuevoCosto}
                        onChange={(e) => updateLinea(idx, { nuevoCosto: e.target.value })}
                        className="input font-mono text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Área</label>
                      <ComboBox value={l.nuevoArea} options={areas} onChange={(v) => updateLinea(idx, { nuevoArea: v })} />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-2">
                      <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Categoría</label>
                      <ComboBox
                        value={l.nuevoCategoria}
                        options={categories}
                        onChange={(v) => updateLinea(idx, { nuevoCategoria: v })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-stone-100 pt-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="rt-fecha" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Fecha de recepción
            </label>
            <input id="rt-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rt-resp" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Responsable <span className="text-stone-400 font-normal lowercase">(quién recibe)</span>
            </label>
            <input
              id="rt-resp"
              value={responsable}
              onChange={(e) => {
                setResponsable(e.target.value);
                setError("");
              }}
              placeholder="Nombre completo"
              className="input"
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {rechazoAbierto ? (
          <div className="border border-brand-200 bg-brand-50/40 rounded-lg p-3 flex flex-col gap-2">
            <label className="text-xs font-medium text-stone-600">¿Por qué se rechaza? (para que {origenNombre} lo sepa)</label>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={2}
              className="input resize-y"
              placeholder="Ej. no llegó lo que se pidió, cantidad incorrecta…"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRechazoAbierto(false)}
                disabled={ocupado}
                className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleRechazar}
                disabled={ocupado}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg cursor-pointer disabled:opacity-60"
              >
                {rechazando ? "Rechazando…" : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => setRechazoAbierto(true)}
              disabled={ocupado}
              className="px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Rechazar traspaso
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={ocupado}
              className="px-5 py-2 text-sm font-semibold text-white bg-leaf-600 hover:bg-leaf-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-60"
            >
              {recibiendo ? "Recibiendo…" : "Confirmar recepción"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
