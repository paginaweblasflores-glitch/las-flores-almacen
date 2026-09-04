import { useState } from "react";
import { LOGIN_EMAIL, LOGIN_USERNAME, supabase } from "../supabaseClient";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError("Por favor completa todos los campos");
      return;
    }

    setError("");
    setLoading(true);

    if (!supabase) {
      setError("La autenticación no está configurada. Contacta al administrador.");
      setLoading(false);
      return;
    }

    if (username.trim().toLowerCase() !== LOGIN_USERNAME.toLowerCase()) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: LOGIN_EMAIL,
      password,
    });

    setLoading(false);
    if (authError) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }

    onLogin();
  };

  return (
    <div
      className="h-dvh overflow-hidden flex items-center justify-center px-4 py-4"
      style={{
        background:
          "radial-gradient(circle at top, rgba(255,255,255,0.12), transparent 32%), linear-gradient(135deg, #4b0811 0%, #7b0d1e 35%, #a6102d 100%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-3xl shadow-xl ring-1 ring-line/70 px-8 py-6 sm:px-10">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="rounded-full border border-brand-200 p-2">
              <img
                src="/logo.png"
                alt="Consorcio Las Flores"
                className="w-12 h-12 object-contain"
              />
            </div>
          </div>

          {/* Título */}
          <div className="text-center mt-3 mb-5">
            <h1 className="font-serif text-2xl font-bold text-brand-600 tracking-tight">
              Sistema Almacén
            </h1>
            <p className="text-sm text-muted mt-1">
              Restaurante Las Flores · desde 1980
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                <p className="text-sm text-brand-700">{error}</p>
              </div>
            )}

            {/* Usuario */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xs font-semibold uppercase tracking-wider text-ink"
              >
                Usuario <span className="text-brand-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  disabled={loading}
                  className="w-full appearance-none rounded-lg border border-line bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:bg-stone-100"
                >
                  <option value="">Selecciona tu usuario...</option>
                  <option value={LOGIN_USERNAME}>{LOGIN_USERNAME}</option>
                </select>
                <svg
                  className="pointer-events-none absolute inset-y-0 right-0 my-auto mr-3.5 h-5 w-5 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Contraseña */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-ink"
              >
                Contraseña <span className="text-brand-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Ingresa tu contraseña"
                  disabled={loading}
                  className="w-full rounded-lg border border-line bg-white px-4 py-3 pr-11 text-base text-ink outline-none transition placeholder:text-stone-400 placeholder:tracking-normal [&:not(:placeholder-shown)]:tracking-[0.25em] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:bg-stone-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted transition-colors hover:text-body"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="btn-brand mt-2 w-full py-3.5 px-4 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar al Sistema
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted mt-5">
            Sistema Almacén · Restaurante Las Flores © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
