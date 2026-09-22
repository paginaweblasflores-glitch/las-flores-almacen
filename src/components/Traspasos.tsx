import { useMemo, useState } from "react";
import { useStore, etiquetaTraspaso } from "../store";
import type { Traspaso, TraspasoEstado } from "../types";
import { cuentaPorAlmacen, type CuentaAlmacen } from "../supabaseClient";
import { normalizar } from "../utils/search";
import NuevoTraspasoForm from "./NuevoTraspasoForm";
import RecibirTraspasoModal from "./RecibirTraspasoModal";
import Pager from "./Pager";

const PAGE_SIZE_DEFAULT = 20;

const ESTADO_LABEL: Record<TraspasoEstado, string> = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  cancelado: "Cancelado",
};
const ESTADO_STYLE: Record<TraspasoEstado, string> = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  recibido: "bg-leaf-50 text-leaf-700 border-leaf-200",
  cancelado: "bg-stone-100 text-stone-500 border-stone-200",
};

function nombreAlmacen(almacen: string): string {
  return cuentaPorAlmacen(almacen)?.nombre ?? almacen;
}

export default function Traspasos({ cuenta }: { cuenta: CuentaAlmacen }) {
  const { almacen, traspasos } = useStore();

  const pendientesRecepcion = useMemo(
    () =>
      traspasos
        .filter((t) => t.almacenDestino === almacen && t.estado === "pendiente")
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [traspasos, almacen],
  );

  const [recibiendo, setRecibiendo] = useState<Traspaso | null>(null);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [detalle, setDetalle] = useState<Traspaso | null>(null);

  const historial = useMemo(() => traspasos.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [traspasos]);

  const filtrados = useMemo(() => {
    const n = normalizar(q);
    if (!n) return historial;
    const palabras = n.split(" ").filter(Boolean);
    return historial.filter((t) => {
      const heno = normalizar(
        `${etiquetaTraspaso(t)} ${nombreAlmacen(t.almacenOrigen)} ${nombreAlmacen(t.almacenDestino)} ${t.responsableEnvio} ${ESTADO_LABEL[t.estado]} ` +
          t.items.map((i) => `${i.codigo} ${i.descripcion}`).join(" "),
      );
      return palabras.every((p) => heno.includes(p));
    });
  }, [historial, q]);

  const pageItems = filtrados.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Traspasos entre almacenes</h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Envía productos de {cuenta.nombre} a otro almacén, o recibe lo que te enviaron.
        </p>
      </div>

      <NuevoTraspasoForm cuenta={cuenta} />

      {/* Pendientes de recepción */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
            Pendientes de recepción {pendientesRecepcion.length > 0 && `(${pendientesRecepcion.length})`}
          </h2>
        </div>
        {pendientesRecepcion.length === 0 ? (
          <p className="text-sm text-stone-400">No tienes traspasos esperando que los recibas.</p>
        ) : (
          <div className="flex flex-col divide-y divide-stone-100">
            {pendientesRecepcion.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-stone-800">
                    <span className="font-mono text-xs text-brand-700 mr-1.5">{etiquetaTraspaso(t)}</span>
                    De {nombreAlmacen(t.almacenOrigen)} · {t.items.length} producto{t.items.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Enviado el {t.fechaEnvio.split("-").reverse().join("/")} por {t.responsableEnvio}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecibiendo(t)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-leaf-600 hover:bg-leaf-700 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                >
                  Recibir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Historial</h2>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por N°, almacén, responsable o producto…"
          className="input max-w-md"
        />
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-auto max-h-[calc(100vh-15rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider [&>th]:bg-stone-50 [&>th]:border-b [&>th]:border-stone-200">
                  <th className="text-left px-4 py-3 whitespace-nowrap">N°</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Origen → Destino</th>
                  <th className="text-right px-4 py-3">Ítems</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-center px-4 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {pageItems.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-stone-600 whitespace-nowrap">{etiquetaTraspaso(t)}</td>
                    <td className="px-4 py-3 text-stone-500">{t.fechaEnvio.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {nombreAlmacen(t.almacenOrigen)} <span className="text-stone-300">→</span> {nombreAlmacen(t.almacenDestino)}
                      {t.almacenOrigen === almacen && <span className="text-[10px] text-stone-400 ml-1.5">(enviado por mí)</span>}
                      {t.almacenDestino === almacen && <span className="text-[10px] text-stone-400 ml-1.5">(para mí)</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-stone-600">{t.items.length}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${ESTADO_STYLE[t.estado]}`}>
                        {ESTADO_LABEL[t.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDetalle(t)}
                        className="px-3 py-1.5 text-xs font-semibold text-brand-700 border border-brand-200 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-stone-400 text-sm">
                      {historial.length === 0
                        ? "Todavía no hay traspasos. Aparecen aquí al enviar o recibir uno."
                        : "Ningún traspaso coincide con la búsqueda."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            pageSize={pageSize}
            total={filtrados.length}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Detalle de un traspaso */}
      {detalle && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 flex flex-col gap-4 my-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Traspaso {etiquetaTraspaso(detalle)}</h3>
                <p className="text-sm text-stone-500 mt-0.5">
                  {nombreAlmacen(detalle.almacenOrigen)} → {nombreAlmacen(detalle.almacenDestino)}
                </p>
              </div>
              <button onClick={() => setDetalle(null)} aria-label="Cerrar" className="p-1 text-stone-400 hover:text-stone-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-xs text-stone-500 flex flex-col gap-0.5">
              <span>
                Estado:{" "}
                <span className={`px-1.5 py-0.5 rounded-full border ${ESTADO_STYLE[detalle.estado]}`}>
                  {ESTADO_LABEL[detalle.estado]}
                </span>
              </span>
              <span>
                Enviado: {detalle.fechaEnvio.split("-").reverse().join("/")} por {detalle.responsableEnvio}
              </span>
              {detalle.motivo && <span>Motivo: {detalle.motivo}</span>}
              {detalle.estado === "recibido" && detalle.fechaRecepcion && (
                <span>
                  Recibido: {detalle.fechaRecepcion.split("-").reverse().join("/")} por {detalle.responsableRecepcion}
                </span>
              )}
              {detalle.estado === "cancelado" && detalle.motivoCancelacion && (
                <span>Motivo: {detalle.motivoCancelacion}</span>
              )}
            </div>

            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider">
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Producto</th>
                    <th className="text-right px-3 py-2">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {detalle.items.map((it, i) => (
                    <tr key={`${it.codigo}-${i}`}>
                      <td className="px-3 py-2 font-mono text-xs text-brand-700">{it.codigo}</td>
                      <td className="px-3 py-2 text-stone-700">{it.descripcion}</td>
                      <td className="px-3 py-2 text-right font-mono text-stone-700">
                        {it.cantidad} {it.unidadMedida}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setDetalle(null)}
                className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {recibiendo && <RecibirTraspasoModal traspaso={recibiendo} onClose={() => setRecibiendo(null)} />}
    </div>
  );
}
