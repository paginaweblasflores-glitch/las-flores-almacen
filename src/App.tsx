import { useState, useEffect } from "react";
import { StoreProvider } from "./store";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Registrar from "./components/Registrar";
import Inventory from "./components/Inventory";
import Entries from "./components/Entries";
import Exits from "./components/Exits";
import CodeSearch from "./components/CodeSearch";
import ExportExcel from "./components/ExportExcel";
import Configuracion from "./components/Configuracion";
import { supabase } from "./supabaseClient";

type Page = "inicio" | "registrar" | "inventario" | "entradas" | "salidas" | "buscar" | "exportar" | "configuracion";

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    id: "registrar",
    label: "Nuevo producto",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" /></svg>,
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  },
  {
    id: "entradas",
    label: "Entradas",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>,
  },
  {
    id: "salidas",
    label: "Salidas",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>,
  },
  {
    id: "buscar",
    label: "Buscar producto",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  },
  {
    id: "exportar",
    label: "Exportar Excel",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

function PageContent({ page }: { page: Page }) {
  if (page === "inicio") return <Dashboard />;
  if (page === "registrar") return <Registrar />;
  if (page === "inventario") return <Inventory />;
  if (page === "entradas") return <Entries />;
  if (page === "salidas") return <Exits />;
  if (page === "buscar") return <CodeSearch />;
  if (page === "exportar") return <ExportExcel />;
  if (page === "configuracion") return <Configuracion />;
  return null;
}

export default function App() {
  const [page, setPage] = useState<Page>("inicio");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session));
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setIsAuthenticated(false);
  };

  if (authLoading) return null;

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <StoreProvider>
      <div className="h-full flex flex-col sm:flex-row bg-canvas">
        {/* Mobile top bar */}
        <div className="sm:hidden flex items-center gap-3 bg-shell text-white px-4 py-3 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="p-1 -ml-1 text-white/80 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/logo.png" alt="Las Flores" className="w-8 h-8 flex-shrink-0 rounded-full bg-white object-contain p-1" />
          <span className="font-serif font-semibold text-sm tracking-tight">Sistema Almacén</span>
        </div>

        {/* Backdrop (mobile drawer) */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 sm:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-shell text-white transition-transform duration-200 sm:static sm:z-auto sm:w-52 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } sm:translate-x-0 overflow-hidden`}
        >
          {/* Title */}
          <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3.5">
            <img src="/logo.png" alt="Las Flores" className="w-9 h-9 flex-shrink-0 rounded-full bg-white object-contain p-1" />
            <span className="font-serif font-semibold text-[15px] tracking-tight whitespace-nowrap">Sistema Almacén</span>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="ml-auto p-1 text-white/60 hover:text-white sm:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setPage(item.id);
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors w-full text-left ${
                  page === item.id
                    ? "bg-brand-500/18 text-brand-200 border-r-2 border-brand-400 font-medium"
                    : "text-white/55 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Cerrar sesión */}
          <div className="border-t border-white/10 pb-2">
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white/50 hover:text-brand-300 hover:bg-white/5 transition-colors"
            >
              <svg className="w-4.5 h-4.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="whitespace-nowrap">Cerrar sesión</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-5 py-5 sm:py-6">
            <PageContent page={page} />
          </div>
        </main>
      </div>
    </StoreProvider>
  );
}
