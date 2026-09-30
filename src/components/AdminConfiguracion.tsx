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
      <div className="flex items-center gap-3 flex-wrap">
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

// Borra el catálogo MAESTRO completo (productos: descripción/unidad/
// categoría/imagen, cada fila identificada por `id`) — a diferencia de
// "Vaciar almacén", esto no es "de una cuenta": es una sola tabla para los
// dos almacenes, así que no hay forma de borrarla "solo para uno". Al
// borrar un producto se cascadea su fila de producto_codigos en cada
// almacén (on delete cascade, ver migration-fase17.sql), pero NO se
// cascadea de ahí a movements a propósito: si todavía hay entradas o
// salidas que referencian ese código (movements_codigo_almacen_fkey),
// Postgres rechaza el delete completo — esa es la red de seguridad real,
// no algo que la UI decida. El mensaje de error se lo explica al admin en
// vez de dejarlo en un error crudo de Postgres.
function EliminarCatalogo() {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [cargandoConteo, setCargandoConteo] = useState(false);
  const [conteo, setConteo] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");

  const FRASE = "ELIMINAR CATALOGO";

  async function abrir() {
    setAbierto(true);
    setConfirmText("");
    setError("");
    setConteo(null);
    if (!supabase) return;
    setCargandoConteo(true);
    const { count, error: countError } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true });
    setCargandoConteo(false);
    if (countError) {
      console.error("Error contando el catálogo:", countError);
      setError("No se pudo contar el catálogo. Vuelve a intentarlo.");
      return;
    }
    setConteo(count ?? 0);
  }

  function cerrar() {
    if (borrando) return;
    setAbierto(false);
  }

  async function confirmarBorrado() {
    if (!supabase) return;
    setBorrando(true);
    setError("");
    const { error: delError } = await supabase.from("productos").delete().not("id", "is", null);
    setBorrando(false);
    if (delError) {
      console.error("Error eliminando el catálogo:", delError);
      if (delError.code === "23503") {
        setError(
          "No se pudo: todavía hay entradas o salidas que usan códigos del catálogo (el cierre de periodo archiva el historial, pero no borra el saldo actual, así que no alcanza para esto). Para vaciar movimientos por completo hace falta hacerlo directo en la base — contactá al equipo de desarrollo.",
        );
      } else {
        setError("No se pudo eliminar el catálogo. Vuelve a intentarlo.");
      }
      return;
    }
    toast.success("Catálogo de productos eliminado en los dos almacenes.");
    setAbierto(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-800">Eliminar el catálogo de productos</p>
          <p className="text-xs text-stone-500 mt-0.5 max-w-md">
            Borra los productos compartidos (código, nombre, unidad, categoría) de <strong>los dos almacenes a la
            vez</strong> — no hay uno por separado, es una sola tabla.
          </p>
        </div>
        <button
          type="button"
          onClick={abrir}
          className="px-3 py-1.5 text-xs font-semibold text-brand-700 border border-brand-300 hover:bg-brand-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
        >
          Eliminar catálogo…
        </button>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">¿Eliminar TODO el catálogo?</h3>
                <p className="text-sm text-stone-500 mt-1">
                  {cargandoConteo ? (
                    "Contando productos…"
                  ) : (
                    <>
                      Se borrarán <strong>{conteo ?? 0}</strong> productos del catálogo compartido —{" "}
                      <strong>Restaurante Las Flores y Hotel Umaru se quedan sin catálogo a la vez</strong>.
                    </>
                  )}
                  <br />
                  <span className="text-brand-700 font-semibold">Esta acción no se puede deshacer.</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admincfg-eliminar-catalogo" className="text-xs font-medium text-stone-500">
                Escribe <span className="font-mono bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">{FRASE}</span> para confirmar
              </label>
              <input
                id="admincfg-eliminar-catalogo"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={FRASE}
                className="input font-mono uppercase"
              />
            </div>

            {error && (
              <div className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={cerrar}
                disabled={borrando}
                className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrado}
                disabled={borrando || cargandoConteo || confirmText.trim().toUpperCase() !== FRASE}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {borrando ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

      <section className="rounded-xl border border-brand-200 bg-brand-50/40">
        <div className="px-5 py-3.5 border-b border-brand-200/70">
          <h2 className="text-sm font-bold text-brand-800 uppercase tracking-wider">Zona de peligro</h2>
        </div>
        <div className="p-5">
          <EliminarCatalogo />
        </div>
      </section>
    </div>
  );
}
