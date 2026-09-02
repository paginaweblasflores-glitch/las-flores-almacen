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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#C41E3A" }}>
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Sistema Almacén</h1>
            <p className="text-sm text-slate-500">Inicia sesión para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Username Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-sm font-semibold text-slate-700">
                Usuario
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
                  className="w-full appearance-none px-4 py-2.5 pr-12 border-2 border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200 transition-all disabled:bg-gray-100"
                >
                  <option value="">Selecciona tu usuario...</option>
                  <option value={LOGIN_USERNAME}>{LOGIN_USERNAME}</option>
                </select>
                <svg
                  className="pointer-events-none absolute inset-y-0 right-0 my-auto mr-3 h-5 w-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Contraseña
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
                  className="w-full px-4 py-2.5 pr-12 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200 transition-all disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
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

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg mt-6"
              style={{
                backgroundColor: "#C41E3A",
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = "#A01730")}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = "#C41E3A")}
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2m14-4V7a2 2 0 00-2-2H7a2 2 0 00-2 2v6" />
                  </svg>
                  Ingresar
                </>
              )}
            </button>
          </form>

          {/* Info Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-500">
              Acceso protegido por Supabase
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
