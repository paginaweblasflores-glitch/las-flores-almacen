import { useState } from "react";
import { useStore, etiquetaTraspaso } from "../store";
import type { Traspaso } from "../types";
import { AREAS } from "../types";
import { cuentaPorAlmacen } from "../supabaseClient";
import ComboBox from "./ComboBox";

const todayISO = () => new Date().toISOString().split("T")[0];

interface LineaState {
  productoId: string;
  descripcion: string;
  unidadMedida?: string;
  cantidadEnviada: number;
  aceptado: boolean; // si está destildado, esta línea se rechaza sola (sin pedir motivo)
  cantidad: string;
  area: string;
}

// `productoId` es la identidad compartida del catálogo maestro (ver
// Producto en types.ts): no hace falta buscar a qué producto propio
// corresponde ni crear uno nuevo. El código de cada línea es LOCAL al
// almacén de ORIGEN — no se muestra acá porque no significa nada para
// quien recibe; el código que le toca a este almacén lo resuelve
// `recibirTraspaso` solo. Lo único que decide el destino por línea es si
// acepta, cuánto, y en qué área.
export default function RecibirTraspasoModal({ traspaso, onClose }: { traspaso: Traspaso; onClose: () => void }) {
  const { areas, recibirTraspaso, cancelarTraspaso } = useStore();
  const origenNombre = cuentaPorAlmacen(traspaso.almacenOrigen)?.nombre ?? traspaso.almacenOrigen;

  const [lineas, setLineas] = useState<LineaState[]>(() =>
    traspaso.items.map((it) => ({
      productoId: it.productoId,
      descripcion: it.descripcion,
      unidadMedida: it.unidadMedida,
      cantidadEnviada: it.cantidad,
      aceptado: true,
      cantidad: String(it.cantidad),
      area: areas[0] ?? AREAS[0],
    })),
  );
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

  type Resuelto = { productoId: string; cantidad: number; area: string };

  function construirResueltos(): { resueltos: Resuelto[] } | { error: string } {
    const resueltos: Resuelto[] = [];
    for (const l of lineas) {
      if (!l.aceptado) continue; // se rechaza sola, no hace falta resolverla a nada

      const cant = Math.floor(Number(l.cantidad));
      if (!cant || cant <= 0) return { error: `Cantidad inválida para "${l.descripcion}".` };
      if (!l.area) return { error: `Falta el área para "${l.descripcion}".` };
      resueltos.push({ productoId: l.productoId, cantidad: cant, area: l.area });
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
  const aceptadasCount = lineas.filter((l) => l.aceptado).length;
  const rechazadasCount = lineas.length - aceptadasCount;

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
          {lineas.map((l, idx) => (
            <div
              key={l.productoId}
              className={`border rounded-lg p-3 flex flex-col gap-2.5 ${
                l.aceptado ? "border-stone-200" : "border-stone-200 bg-stone-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={l.aceptado}
                    onChange={(e) => updateLinea(idx, { aceptado: e.target.checked })}
                    className="accent-leaf-600 flex-shrink-0"
                  />
                  <span className={`truncate ${l.aceptado ? "text-stone-800" : "text-stone-400 line-through"}`}>
                    {l.descripcion}
                  </span>
                </label>
                <span className="text-xs text-stone-400 flex-shrink-0">
                  Enviado: {l.cantidadEnviada} {l.unidadMedida || "UNID"}
                </span>
              </div>

              {!l.aceptado ? (
                <p className="text-xs text-brand-600 pl-6">Este producto se va a rechazar — no suma stock.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="w-28 flex-shrink-0">
                    <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Cantidad a recibir</label>
                    <input
                      type="number"
                      min="1"
                      value={l.cantidad}
                      onChange={(e) => updateLinea(idx, { cantidad: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className="input font-mono mt-0.5"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                      Área destino <span className="text-stone-400 font-normal lowercase">(elige o escribe otra)</span>
                    </label>
                    <div className="mt-0.5">
                      <ComboBox value={l.area} options={areas} onChange={(v) => updateLinea(idx, { area: v })} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
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
              {recibiendo
                ? "Recibiendo…"
                : rechazadasCount > 0
                ? `Confirmar recepción (${aceptadasCount} de ${lineas.length})`
                : "Confirmar recepción"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
