import { useMemo, useState } from "react";
import { construirCierre, useStore } from "../store";
import { useToast } from "../toast";
import { type CuentaAlmacen } from "../supabaseClient";
import { descargarHoja, movimientoAFila } from "../utils/excel";

export default function Configuracion({
  cuenta,
  onVerGuiaCierre,
}: {
  cuenta: CuentaAlmacen;
  onVerGuiaCierre: () => void;
}) {
  const { movements, cerrarAnio } = useStore();
  const toast = useToast();

  // ---- Cierre de periodo (anual) ----
  const anioActual = new Date().getFullYear();
  const anioACerrar = anioActual - 1;
  const preview = useMemo(() => construirCierre(movements, anioACerrar), [movements, anioACerrar]);
  const hayQueCerrar = preview.archivados.length > 0;

  const [cierreOpen, setCierreOpen] = useState(false);
  const [descargado, setDescargado] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [cierreText, setCierreText] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [cierreError, setCierreError] = useState("");
  const [cierreResumen, setCierreResumen] = useState("");

  const frase = `CERRAR ${anioACerrar}`;
  const puedeCerrar =
    descargado && guardadoOk && cierreText.trim().toUpperCase() === frase && !cerrando;

  function abrirCierre() {
    setDescargado(false);
    setGuardadoOk(false);
    setCierreText("");
    setCierreError("");
    setCierreResumen("");
    setCierreOpen(true);
  }

  function cerrarModalCierre() {
    if (cerrando) return;
    setCierreOpen(false);
  }

  function descargarRespaldo() {
    descargarHoja(`Movimientos-${anioACerrar}.xlsx`, preview.archivados.map(movimientoAFila));
    setDescargado(true);
  }

  async function confirmarCierre() {
    setCerrando(true);
    setCierreError("");
    const r = await cerrarAnio(anioACerrar);
    setCerrando(false);
    if (r.error) {
      setCierreError(r.error);
      return;
    }
    setCierreOpen(false);
    setCierreResumen(
      `Cierre de ${anioACerrar} hecho: se archivaron ${r.archivados} movimientos y quedaron ${preview.saldos.length} productos con su stock actual.`,
    );
    toast.success(`Cierre de ${anioACerrar} completado.`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Configuración</h1>
        <p className="text-sm text-stone-400 mt-0.5">Cuenta de acceso y acciones del sistema.</p>
      </div>

      {/* ---- Cuenta ---- */}
      <section className="bg-white border border-stone-200 rounded-xl shadow-xs">
        <div className="px-5 py-3.5 border-b border-stone-100">
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Cuenta de acceso</h2>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Usuario</span>
            <span className="text-sm font-medium text-stone-800">{cuenta.usuario}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Almacén</span>
            <span className="text-sm font-medium text-stone-800">{cuenta.nombre}</span>
          </div>

          {/* La contraseña ya no se cambia desde acá: solo el Administrador
              puede cambiarla, desde su propio panel. */}
          <div className="border-t border-stone-100 pt-4 max-w-md">
            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Cambiar contraseña</h3>
            <p className="text-xs text-stone-500">
              Para cambiar la contraseña de esta cuenta, contactá al administrador.
            </p>
          </div>

          {/* "Vaciar almacén" ya no está acá: es una acción demasiado
              riesgosa para dejarla al alcance de cada almacenero — ahora
              solo la puede disparar el Administrador, desde AdminConfiguracion. */}
          <div className="border-t border-stone-100 pt-4 max-w-md">
            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Vaciar almacén</h3>
            <p className="text-xs text-stone-500">
              Para vaciar este almacén, contactá al administrador.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Cierre de periodo ---- */}
      <section className="bg-white border border-stone-200 rounded-xl shadow-xs">
        <div className="px-5 py-3.5 border-b border-stone-100">
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Cierre de periodo</h2>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <p className="text-sm text-stone-600 leading-relaxed">
            Una vez al año se archiva el detalle de movimientos del año anterior y el sistema queda solo
            con el <strong>stock actual</strong> de cada producto. El stock y los costos <strong>no
            cambian</strong>: solo se comprime el historial para que la base siga liviana. El detalle
            archivado se descarga en un Excel antes de borrar nada.
          </p>

          <button
            onClick={onVerGuiaCierre}
            className="self-start text-sm text-brand-600 hover:text-brand-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Más detalles: cómo se hace el cierre paso a paso
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {cierreResumen ? (
            <div className="text-xs text-leaf-800 bg-leaf-50 border border-leaf-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-leaf-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{cierreResumen}</span>
            </div>
          ) : hayQueCerrar ? (
            <>
              <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-amber-900">
                Hay <strong>{preview.archivados.length}</strong> movimientos con fecha del {anioACerrar} o
                anteriores. Al cerrar quedarán <strong>{preview.saldos.length}</strong> productos con su
                saldo inicial {anioActual}.
              </div>
              <button
                onClick={abrirCierre}
                className="self-start px-3 py-2 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Preparar cierre de {anioACerrar}…
              </button>
            </>
          ) : (
            <p className="text-xs text-stone-400">
              No hay periodos para cerrar todavía. El primer cierre corresponderá en enero de {anioActual + 1}.
            </p>
          )}
        </div>
      </section>

      {/* Modal de cierre de periodo */}
      {cierreOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 flex flex-col gap-4 my-8">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Cierre del año {anioACerrar}</h3>
                <p className="text-sm text-stone-500 mt-1">
                  Se archivarán <strong>{preview.archivados.length}</strong> movimientos y quedarán{" "}
                  <strong>{preview.saldos.length}</strong> productos con su stock actual. El stock y los
                  costos no cambian.
                </p>
              </div>
            </div>

            {preview.negativos > 0 && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {preview.negativos} producto(s) tienen stock negativo y quedarán en 0.
              </div>
            )}

            {/* Vista previa de saldos */}
            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Saldo inicial {anioActual} — {preview.saldos.length} productos
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                      <th className="text-left px-3 py-1.5">Código</th>
                      <th className="text-left px-3 py-1.5">Producto</th>
                      <th className="text-right px-3 py-1.5">Stock 31/12</th>
                      <th className="text-right px-3 py-1.5">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {preview.saldos.map((s) => (
                      <tr key={s.codigo}>
                        <td className="px-3 py-1.5 font-mono text-brand-700">{s.codigo}</td>
                        <td className="px-3 py-1.5 text-stone-700 truncate max-w-[220px]">{s.descripcion}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-stone-700">{s.cantidad}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-stone-500">S/ {s.costo.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paso 1: descargar respaldo */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-stone-600">1. Descargá el respaldo del detalle</p>
              <button
                onClick={descargarRespaldo}
                className="self-start px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar Movimientos-{anioACerrar}.xlsx
              </button>
              {descargado && (
                <span className="text-xs text-leaf-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Archivo descargado
                </span>
              )}
            </div>

            {/* Paso 2: confirmar guardado */}
            <label
              className={`flex items-center gap-2 text-xs select-none ${
                descargado ? "text-stone-600 cursor-pointer" : "text-stone-300 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                disabled={!descargado}
                checked={guardadoOk}
                onChange={(e) => setGuardadoOk(e.target.checked)}
                className="accent-amber-600"
              />
              2. Ya guardé el Excel en un lugar seguro
            </label>

            {/* Paso 3: escribir la frase */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-cierre" className="text-xs font-medium text-stone-500">
                3. Escribe <span className="font-mono bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">{frase}</span> para confirmar
              </label>
              <input
                id="cfg-cierre"
                value={cierreText}
                onChange={(e) => setCierreText(e.target.value)}
                placeholder={frase}
                className="input font-mono uppercase"
              />
            </div>

            {cierreError && (
              <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2.5">
                {cierreError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={cerrarModalCierre}
                disabled={cerrando}
                className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCierre}
                disabled={!puedeCerrar}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {cerrando ? "Cerrando…" : "Hacer el cierre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
