import { useState } from "react";
import { useStore } from "../store";
import { useToast } from "../toast";
import { LOGIN_USERNAME, supabase } from "../supabaseClient";

export default function Configuracion() {
  const { inventory, movements, clearAll } = useStore();
  const toast = useToast();

  // ---- Vaciar almacén ----
  const [vaciarOpen, setVaciarOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function handleVaciar() {
    clearAll();
    setVaciarOpen(false);
    setConfirmText("");
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
