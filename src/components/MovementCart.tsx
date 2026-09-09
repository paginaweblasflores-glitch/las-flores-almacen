import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store";
import { AREAS } from "../types";
import type { CartLine, MovementType, TicketData } from "../types";
import ComboBox from "./ComboBox";
import { filtrarBusqueda } from "../utils/search";

interface Props {
  tipo: MovementType;
}

const todayISO = () => new Date().toISOString().split("T")[0];

export default function MovementCart({ tipo }: Props) {
  const { inventory, areas, addMovements } = useStore();
  const esSalida = tipo === "Salida";

  const [lines, setLines] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [fecha, setFecha] = useState(todayISO());
  // Solo la Salida usa área destino + responsable (así lo maneja el Excel de Rio).
  const [areaDestino, setAreaDestino] = useState<string>(areas[0] ?? AREAS[0]);
  const [responsable, setResponsable] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [error, setError] = useState("");

  const searchRef = useRef<HTMLDivElement>(null);

  // Precarga el logo para que ya esté en caché cuando toque imprimir.
  useEffect(() => {
    const img = new Image();
    img.src = "/logo.png";
  }, []);

  // Imprime el comprobante apenas se registra una salida, esperando a que
  // el logo del comprobante haya terminado de cargar (si no, sale roto).
  useEffect(() => {
    if (!esSalida || !ticket) return;
    let done = false;
    const doPrint = () => {
      if (done) return;
      done = true;
      window.print();
    };
    const logo = document.querySelector<HTMLImageElement>(".ticket-portal img");
    if (logo && !logo.complete) {
      logo.addEventListener("load", doPrint, { once: true });
      logo.addEventListener("error", doPrint, { once: true });
      const fallback = window.setTimeout(doPrint, 1500);
      const after = () => setTicket(null);
      window.addEventListener("afterprint", after);
      return () => {
        window.clearTimeout(fallback);
        window.removeEventListener("afterprint", after);
      };
    }
    doPrint();
    const after = () => setTicket(null);
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, [ticket, esSalida]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const enCarrito = useMemo(
    () => new Set(lines.map((l) => l.codigo.toUpperCase().trim())),
    [lines]
  );

  const results = useMemo(
    () =>
      filtrarBusqueda(
        inventory,
        search,
        (i) => i.codigo,
        (i) => i.descripcion,
      ).slice(0, 30),
    [search, inventory],
  );

  const overStock = (l: CartLine) => esSalida && l.cantidad > l.stockActual;
  const canSubmit =
    lines.length > 0 &&
    (esSalida
      ? responsable.trim() !== "" && lines.every((l) => !overStock(l))
      : true);

  function addLine(item: (typeof inventory)[number]) {
    const key = item.codigo.toUpperCase().trim();
    // En una salida no se puede retirar un producto agotado.
    if (esSalida && item.cantidadDisponible <= 0) {
      setError(`"${item.descripcion}" no tiene stock disponible. No se puede registrar su salida.`);
      setSearch("");
      setShowResults(false);
      return;
    }
    setError("");
    setLines((prev) => {
      const existing = prev.find((l) => l.codigo.toUpperCase().trim() === key);
      if (existing) {
        return prev.map((l) =>
          l.codigo.toUpperCase().trim() === key ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      return [
        ...prev,
        {
          codigo: item.codigo,
          descripcion: item.descripcion,
          unidadMedida: item.unidadMedida,
          costo: item.costo,
          categoria: item.categoria,
          area: item.area,
          stockActual: item.cantidadDisponible,
          cantidad: 1,
        },
      ];
    });
    setSearch("");
    setShowResults(false);
  }

  function setQty(codigo: string, raw: string) {
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    setLines((prev) => prev.map((l) => (l.codigo === codigo ? { ...l, cantidad: n } : l)));
  }

  function removeLine(codigo: string) {
    setLines((prev) => prev.filter((l) => l.codigo !== codigo));
  }

  function handleRegister() {
    if (!canSubmit) return;
    setError("");
    setConfirmOpen(true);
  }

  function confirmRegister() {
    const inputs = lines.map((l) => ({
      codigo: l.codigo.toUpperCase().trim(),
      descripcion: l.descripcion.trim(),
      cantidad: l.cantidad,
      unidadMedida: l.unidadMedida,
      costo: l.costo,
      fecha,
      // Entrada: sin responsable ni área (Rio recibe en el almacén). Salida: los del formulario.
      responsable: esSalida ? responsable.trim() : "Almacén",
      area: esSalida ? areaDestino : l.area || "Almacén 1",
      categoria: l.categoria,
      tipo,
      motivo: esSalida && observaciones.trim() ? observaciones.trim() : undefined,
    }));

    const err = addMovements(inputs);
    if (err) {
      setError(err);
      return;
    }

    if (esSalida) {
      setTicket({
        fecha,
        area: areaDestino,
        responsable: responsable.trim().toUpperCase(),
        observaciones: observaciones.trim() || undefined,
        items: lines.map((l) => ({
          codigo: l.codigo,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          unidadMedida: l.unidadMedida || "UNID",
        })),
      });
    }

    setLines([]);
    setResponsable("");
    setObservaciones("");
    setConfirmOpen(false);
    setError("");
  }

  return (
    <>
      <div className="no-print bg-white border border-stone-200 rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
          <div className={`w-2.5 h-2.5 rounded-full ${esSalida ? "bg-brand-500" : "bg-leaf-500"}`} />
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
            {esSalida ? "Registrar salida de productos" : "Registrar entrada de productos"}
          </h2>
        </div>

        {/* Buscador */}
        <div className="relative" ref={searchRef}>
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Buscar producto por código o nombre
          </label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Ej. copa, 100, escoba…"
            className="input mt-1"
            autoComplete="off"
          />
          {showResults && results.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-72 overflow-auto">
              {results.map((item) => {
                const ya = enCarrito.has(item.codigo.toUpperCase().trim());
                const agotado = esSalida && item.cantidadDisponible <= 0;
                const stockColor =
                  item.cantidadDisponible <= 0
                    ? "text-brand-600"
                    : item.cantidadDisponible <= 5
                    ? "text-amber-600"
                    : "text-leaf-600";
                return (
                  <button
                    key={item.codigo}
                    type="button"
                    onClick={() => addLine(item)}
                    disabled={agotado}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-stone-50 last:border-0 ${
                      agotado ? "opacity-50 cursor-not-allowed" : "hover:bg-stone-50 cursor-pointer"
                    }`}
                  >
                    {item.imagen ? (
                      <img
                        src={item.imagen}
                        alt=""
                        className="w-8 h-8 rounded object-cover border border-stone-200 flex-shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded bg-stone-100 text-stone-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm text-stone-800 truncate">
                        <span className="font-mono text-xs text-brand-700 mr-1.5">{item.codigo}</span>
                        {item.descripcion}
                      </span>
                      <span className={`text-[11px] ${stockColor}`}>
                        Stock: {item.cantidadDisponible} {item.unidadMedida || "UNID"}
                      </span>
                    </div>
                    {agotado && (
                      <span className="text-[10px] bg-brand-50 text-brand-600 border border-brand-200 px-1.5 py-0.5 rounded-full flex-shrink-0 font-semibold">
                        Sin stock
                      </span>
                    )}
                    {!agotado && ya && (
                      <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        en carrito
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="border border-stone-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Producto</th>
                  <th className="text-right px-4 py-2.5">Stock actual</th>
                  <th className="text-right px-4 py-2.5 w-32">Cantidad</th>
                  <th className="px-2 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-stone-400 text-sm">
                      Agrega productos desde el buscador.
                    </td>
                  </tr>
                )}
                {lines.map((l) => {
                  const over = overStock(l);
                  return (
                    <tr key={l.codigo} className={over ? "bg-brand-50/60" : ""}>
                      <td className="px-4 py-2.5 text-stone-800">
                        <span className="font-mono text-xs text-brand-700 mr-1.5">{l.codigo}</span>
                        {l.descripcion}
                        {over && (
                          <div className="text-[11px] text-brand-600 mt-0.5">
                            Solo hay {l.stockActual} disponible{l.stockActual === 1 ? "" : "s"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-stone-500">{l.stockActual}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          min="1"
                          value={l.cantidad}
                          onChange={(e) => setQty(l.codigo, e.target.value)}
                          className={`input font-mono text-right w-24 ${over ? "border-brand-400 bg-brand-50/40 text-brand-800" : ""}`}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(l.codigo)}
                          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors cursor-pointer"
                          title="Quitar del carrito"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campos compartidos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="cart-fecha" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Fecha
            </label>
            <input
              id="cart-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="input"
            />
          </div>

          {esSalida && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Área destino <span className="text-stone-400 font-normal lowercase">(elige o escribe otra)</span>
                </label>
                <ComboBox id="cart-area" value={areaDestino} options={areas} onChange={setAreaDestino} />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="cart-resp" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Responsable <span className="text-stone-400 font-normal lowercase">(quién retira / pide)</span>
                </label>
                <input
                  id="cart-resp"
                  value={responsable}
                  onChange={(e) => {
                    setResponsable(e.target.value);
                    setError("");
                  }}
                  placeholder="Nombre completo"
                  className="input"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="cart-obs" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Observaciones <span className="text-stone-400 font-normal lowercase">(opcional)</span>
                </label>
                <textarea
                  id="cart-obs"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Comentario sobre esta salida, si hace falta"
                  rows={2}
                  className="input resize-y"
                />
              </div>
            </>
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

        {esSalida && lines.some((l) => overStock(l)) && (
          <p className="text-xs text-brand-600 font-medium">
            Hay productos con más cantidad que su stock. Ajusta las cantidades para poder registrar.
          </p>
        )}

        <button
          type="button"
          onClick={handleRegister}
          disabled={!canSubmit}
          className={`w-full py-3 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:bg-stone-300 disabled:cursor-not-allowed disabled:text-stone-500 ${
            esSalida
              ? "bg-brand-600 hover:bg-brand-700 active:bg-brand-800"
              : "bg-leaf-600 hover:bg-leaf-700 active:bg-leaf-800"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Registrar {esSalida ? "salida" : "entrada"} ({lines.length})
        </button>
      </div>

      {/* Modal de confirmación */}
      {confirmOpen && (
        <div className="no-print fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-stone-900">
              ¿Registrar la {esSalida ? "salida" : "entrada"} de {lines.length} producto{lines.length === 1 ? "" : "s"}?
            </h3>
            <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-56 overflow-auto text-sm">
              {lines.map((l) => (
                <div key={l.codigo} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-stone-700 truncate">
                    <span className="font-mono text-xs text-brand-700 mr-1.5">{l.codigo}</span>
                    {l.descripcion}
                  </span>
                  <span className="font-mono text-stone-800 flex-shrink-0">
                    {l.cantidad} {l.unidadMedida || "UNID"}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-stone-500 flex flex-col gap-0.5">
              <span>Fecha: {fecha.split("-").reverse().join("/")}</span>
              {esSalida && <span>Área destino: {areaDestino}</span>}
              {esSalida && <span>Responsable: {responsable.trim().toUpperCase()}</span>}
              {esSalida && observaciones.trim() && <span>Observaciones: {observaciones.trim()}</span>}
              {esSalida && <span className="text-stone-400">Se imprimirá un comprobante.</span>}
            </div>
            {error && (
              <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRegister}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer shadow-xs ${
                  esSalida
                    ? "bg-brand-600 hover:bg-brand-700"
                    : "bg-leaf-600 hover:bg-leaf-700"
                }`}
              >
                Confirmar y registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprobante de salida — portal en body para impresión limpia */}
      {ticket &&
        createPortal(
          <div className="ticket-portal">
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "6px", marginBottom: "6px" }}>
              <img
                src="/logo.png"
                alt="Las Flores"
                style={{ width: "40px", height: "40px", objectFit: "contain", display: "block", margin: "0 auto 4px" }}
              />
              <div style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "0.02em", color: "#000" }}>
                Corporación Las Flores
              </div>
              <div style={{ fontWeight: 700, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#000", marginTop: "2px" }}>
                Comprobante de Salida de Almacén
              </div>
            </div>

            <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
              {[
                ["Fecha", ticket.fecha.split("-").reverse().join("/")],
                ["Área destino", ticket.area],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11px", lineHeight: "1.6", fontWeight: 700, color: "#000" }}
                >
                  <span style={{ flexShrink: 0 }}>{label}</span>
                  <span style={{ textAlign: "right", wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "60%" }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "10px", fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #000", paddingBottom: "3px", marginBottom: "4px" }}
              >
                <span>Producto</span>
                <span style={{ flexShrink: 0 }}>Cant.</span>
              </div>
              {ticket.items.map((it, idx) => (
                <div
                  key={`${it.codigo}-${idx}`}
                  style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11px", lineHeight: "1.5", fontWeight: 700, color: "#000", marginBottom: "2px" }}
                >
                  <span style={{ wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "62%" }}>
                    {it.descripcion}
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    {it.cantidad} {it.unidadMedida}
                  </span>
                </div>
              ))}
            </div>

            {ticket.observaciones && (
              <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                  Observaciones
                </div>
                <div style={{ fontSize: "11px", lineHeight: "1.5", fontWeight: 700, color: "#000", wordBreak: "break-word", overflowWrap: "break-word" }}>
                  {ticket.observaciones}
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", paddingTop: ticket.observaciones ? "55px" : "75px" }}>
              <div style={{ borderTop: "1px solid #000", width: "60%", margin: "0 auto 4px" }} />
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#000" }}>{ticket.responsable}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: "#000" }}>Firma de quien retira</div>
            </div>

            <div style={{ textAlign: "center", borderTop: "1px dashed #000", marginTop: "10px", paddingTop: "5px", fontSize: "9px", fontWeight: 700, color: "#000" }}>
              Sistema Almacén · Corporación Las Flores
            </div>

            <br />
            <br />
            <br />
            <br />
            <br />
          </div>,
          document.body
        )}
    </>
  );
}
