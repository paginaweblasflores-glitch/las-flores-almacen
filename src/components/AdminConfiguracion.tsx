import { useState } from "react";
import { supabase, type CuentaAlmacen } from "../supabaseClient";
import { useToast } from "../toast";

function FilaCuenta({ cuenta }: { cuenta: CuentaAlmacen }) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function cerrar() {
    setAbierto(false);
    setNueva("");
    setRepetir("");
    setError("");
    setShowPass(false);
  }

  async function confirmar() {
    setError("");
    if (!supabase) {
      setError("La autenticación no está configurada.");
      return;
    }
    if (!nueva || !repetir) {
      setError("Completa los dos campos.");
      return;
    }
    if (nueva.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nueva !== repetir) {
      setError("La nueva contraseña y su repetición no coinciden.");
      return;
    }

    setGuardando(true);
    const { error: rpcError } = await supabase.rpc("admin_cambiar_password", {
      objetivo_email: cuenta.email,
      nueva_password: nueva,
    });
    setGuardando(false);
    if (rpcError) {
      setError(rpcError.message || "No se pudo cambiar la contraseña.");
      return;
    }
    toast.success(`Contraseña de "${cuenta.usuario}" actualizada.`);
    cerrar();
  }

  return (
    <div className="border border-stone-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img src={cuenta.logo} alt={cuenta.nombre} className="w-9 h-9 flex-shrink-0 rounded-full bg-white border border-stone-200 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800 truncate">{cuenta.usuario}</p>
          <p className="text-xs text-stone-400 truncate">{cuenta.nombre}</p>
        </div>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            Cambiar contraseña
          </button>
        )}
      </div>

      {abierto && (
        <div className="border-t border-stone-100 pt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Nueva contraseña</label>
              <input
                type={showPass ? "text" : "password"}
                value={nueva}
                onChange={(e) => {
                  setNueva(e.target.value);
                  setError("");
                }}
                className="input font-mono"
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Repetir nueva</label>
              <input
                type={showPass ? "text" : "password"}
                value={repetir}
                onChange={(e) => {
                  setRepetir(e.target.value);
                  setError("");
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

          {error && (
            <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={cerrar}
              disabled={guardando}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={guardando}
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminConfiguracion({ cuentas }: { cuentas: CuentaAlmacen[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Configuración</h1>
        <p className="text-sm text-stone-400 mt-0.5">Cuentas de acceso del sistema.</p>
      </div>

      <section className="bg-white border border-stone-200 rounded-xl shadow-xs">
        <div className="px-5 py-3.5 border-b border-stone-100">
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Cuentas y contraseñas</h2>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {cuentas.map((c) => (
            <FilaCuenta key={c.usuario} cuenta={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
