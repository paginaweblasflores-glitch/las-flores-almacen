import { useMemo, useState } from "react";
import { useStore, etiquetaComprobante } from "../store";
import type { Comprobante } from "../types";
import { normalizar } from "../utils/search";
import ComprobanteSalida, { usarImpresionComprobante } from "./ComprobanteSalida";
import Pager from "./Pager";

const PAGE_SIZE_DEFAULT = 20;

export default function Comprobantes() {
  const { comprobantes } = useStore();
  const todos = useMemo(
    () =>
      comprobantes
        .filter((c) => c.tipo === "Salida")
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [comprobantes],
  );

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [detalle, setDetalle] = useState<Comprobante | null>(null);
  const [ticket, imprimir] = usarImpresionComprobante();

  const filtrados = useMemo(() => {
    const n = normalizar(q);
    if (!n) return todos;
    const palabras = n.split(" ").filter(Boolean);
    return todos.filter((c) => {
      const heno = normalizar(
        `${etiquetaComprobante(c)} ${c.fecha.split("-").reverse().join("/")} ${c.area} ${c.responsable} ` +
          c.items.map((i) => `${i.codigo} ${i.descripcion}`).join(" "),
      );
      return palabras.every((p) => heno.includes(p));
    });
  }, [todos, q]);

  const pageItems = filtrados.slice((page - 1) * pageSize, page * pageSize);

  function reimprimir(c: Comprobante) {
    setDetalle(null);
    imprimir({
      numero: etiquetaComprobante(c),
      fecha: c.fecha,
      area: c.area,
      responsable: c.responsable,
      observaciones: c.observaciones,
      items: c.items,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-stone-900">Comprobantes de salida</h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Copia de cada comprobante impreso en la tiquetera. Si se pierde el papel, acá está el detalle y se puede volver a imprimir.
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Buscar por N°, responsable, área o producto…"
        className="input max-w-md no-print"
      />

      <div className="no-print bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-auto max-h-[calc(100vh-15rem)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider [&>th]:bg-stone-50 [&>th]:border-b [&>th]:border-stone-200">
                <th className="text-left px-4 py-3 whitespace-nowrap">N° de Salida</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Área destino</th>
                <th className="text-left px-4 py-3">Responsable</th>
                <th className="text-right px-4 py-3">Ítems</th>
                <th className="text-center px-4 py-3">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {pageItems.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-stone-600 whitespace-nowrap">{etiquetaComprobante(c)}</td>
                  <td className="px-4 py-3 text-stone-500">{c.fecha.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{c.area}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-700">{c.responsable}</td>
                  <td className="px-4 py-3 text-right font-mono text-stone-600">{c.items.length}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDetalle(c)}
                      className="px-3 py-1.5 text-xs font-semibold text-brand-700 border border-brand-200 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Ver / reimprimir
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-stone-400 text-sm">
                    {todos.length === 0
                      ? "Todavía no hay comprobantes. Aparecen aquí al registrar una salida."
                      : "Ningún comprobante coincide con la búsqueda."}
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

      {/* Detalle de un comprobante */}
      {detalle && (
        <div className="no-print fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 flex flex-col gap-4 my-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Comprobante {etiquetaComprobante(detalle)}</h3>
                <p className="text-sm text-stone-500 mt-0.5">
                  {detalle.fecha.split("-").reverse().join("/")} · {detalle.area} · {detalle.responsable}
                </p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                aria-label="Cerrar"
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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

            {detalle.observaciones && (
              <div>
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Observaciones</span>
                <p className="text-sm text-stone-700 mt-0.5">{detalle.observaciones}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDetalle(null)}
                className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={() => reimprimir(detalle)}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-xs flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Reimprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {ticket && <ComprobanteSalida ticket={ticket} />}
    </div>
  );
}
