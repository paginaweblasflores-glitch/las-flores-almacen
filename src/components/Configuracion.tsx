import { useMemo, useState } from "react";
import { construirCierre, useStore } from "../store";
import { useToast } from "../toast";
import { LOGIN_USERNAME, supabase } from "../supabaseClient";
import { descargarHoja, movimientoAFila } from "../utils/excel";

export default function Configuracion({ onVerGuiaCierre }: { onVerGuiaCierre: () => void }) {
  const { inventory, movements, clearAll, cerrarAnio } = useStore();
  const toast = useToast();

  // ---- Vaciar almacén ----
  const [vaciarOpen, setVaciarOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function handleVaciar() {
    clearAll();
    setVaciarOpen(false);
    setConfirmText("");
  }

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

  // ---- Cambiar contraseña ----
  const [showPass, setShowPass] = useState(false);
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState("");

  async function handleCambiarPass(e: React.FormEvent) {
    e.preventDefault();
    setPassError("");

    if (!supabase) {
      setPassError("La autenticación no está configurada.");
      return;
    }
    if (!nueva || !repetir) {
      setPassError("Completa los dos campos.");
      return;
    }
    if (nueva.length < 6) {
      setPassError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nueva !== repetir) {
      setPassError("La nueva contraseña y su repetición no coinciden.");
      return;
    }

    setSavingPass(true);
    const { error: updError } = await supabase.auth.updateUser({ password: nueva });
    setSavingPass(false);
    if (updError) {
      setPassError("No se pudo cambiar la contraseña. Vuelve a intentarlo.");
      return;
    }
    setNueva("");
    setRepetir("");
    toast.success("Contraseña actualizada.");
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
            <span className="text-sm font-medium text-stone-800">{LOGIN_USERNAME}</span>
          </div>

          {/* Cambiar contraseña */}
          <form onSubmit={handleCambiarPass} className="border-t border-stone-100 pt-4 flex flex-col gap-3 max-w-md">
            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider">Cambiar contraseña</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="cfg-nueva" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Nueva contraseña
                </label>
                <input
                  id="cfg-nueva"
                  type={showPass ? "text" : "password"}
                  value={nueva}
                  onChange={(e) => {
                    setNueva(e.target.value);
                    setPassError("");
                  }}
                  className="input font-mono"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cfg-repetir" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Repetir nueva
                </label>
                <input
                  id="cfg-repetir"
                  type={showPass ? "text" : "password"}
                  value={repetir}
                  onChange={(e) => {
                    setRepetir(e.target.value);
                    setPassError("");
                  }}
                  className="input font-mono"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPass}
                onChange={(e) => setShowPass(e.target.checked)}
                className="accent-brand-600"
              />
              Mostrar lo que escribo
            </label>

            {passError && (
              <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                {passError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPass}
              className="self-start px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPass ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </form>
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

      {/* ---- Zona de peligro ---- */}
      <section className="rounded-xl border border-brand-200 bg-brand-50/40">
        <div className="px-5 py-3.5 border-b border-brand-200/70">
          <h2 className="text-sm font-bold text-brand-800 uppercase tracking-wider">Zona de peligro</h2>
        </div>
        <div className="p-5">
          <p className="text-sm font-semibold text-brand-800">Vaciar todo el almacén</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Borra los <strong>{inventory.length}</strong> productos y sus <strong>{movements.length}</strong> movimientos.
            Esta acción es <strong>irreversible</strong>.
          </p>
          <button
            onClick={() => setVaciarOpen(true)}
            disabled={inventory.length === 0}
            className="mt-3 px-3 py-2 border border-brand-300 text-brand-700 hover:bg-brand-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Vaciar almacén…
          </button>
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

      {/* Modal de confirmación de vaciado */}
      {vaciarOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">¿Vaciar todo el almacén?</h3>
                <p className="text-sm text-stone-500 mt-1">
                  Se borrarán <strong>{inventory.length}</strong> productos y <strong>{movements.length}</strong> movimientos.
                  <br />
                  <span className="text-brand-700 font-semibold">Esta acción no se puede deshacer.</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-vaciar" className="text-xs font-medium text-stone-500">
                Escribe <span className="font-mono bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">VACIAR</span> para confirmar
              </label>
              <input
                id="cfg-vaciar"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="VACIAR"
                className="input font-mono uppercase"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setVaciarOpen(false);
                  setConfirmText("");
                }}
                className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleVaciar}
                disabled={confirmText.trim().toUpperCase() !== "VACIAR"}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                Vaciar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
