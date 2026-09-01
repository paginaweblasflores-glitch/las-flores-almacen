import { useState } from "react";

interface LoginProps {
  onLogin: (username: string, password: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError("Por favor completa todos los campos");
      return;
    }

    setError("");
    setLoading(true);
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      setLoading(false);
      onLogin(username, password);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#C41E3A" }}>
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo Section */}
          <div className="flex justify-center mb-8">
            <div 
              className="w-32 h-32 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-white"
            >
              <img
                src="./assets/Flores.png"
                alt="Logo Sistema Almacén"
                className="w-full h-full object-cover"
                onError={(e) => console.error("Error cargando imagen:", e)}
              />
            </div>
          </div>

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
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="Ingresa tu usuario"
                disabled={loading}
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200 transition-all disabled:bg-gray-100"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Ingresa tu contraseña"
                disabled={loading}
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200 transition-all disabled:bg-gray-100"
              />
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
              Demo: usa cualquier usuario y contraseña
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
