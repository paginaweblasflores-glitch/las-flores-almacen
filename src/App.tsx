import { useState } from "react";
import { StoreProvider } from "./store";
import Dashboard from "./components/Dashboard";
import Registrar from "./components/Registrar";
import Inventory from "./components/Inventory";
import Entries from "./components/Entries";
import Exits from "./components/Exits";
import DateSearch from "./components/DateSearch";
import CodeSearch from "./components/CodeSearch";
import ExportExcel from "./components/ExportExcel";
import floresLogo from "./assets/Flores.png";

type Page = "inicio" | "registrar" | "inventario" | "entradas" | "salidas" | "fechas" | "buscar" | "exportar";

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    id: "registrar",
    label: "Registrar",
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
    id: "fechas",
    label: "Por fechas",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    id: "buscar",
    label: "Buscar código",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  },
  {
    id: "exportar",
    label: "Exportar Excel",
    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
];

function PageContent({ page }: { page: Page }) {
  if (page === "inicio") return <Dashboard />;
  if (page === "registrar") return <Registrar />;
  if (page === "inventario") return <Inventory />;
  if (page === "entradas") return <Entries />;
  if (page === "salidas") return <Exits />;
  if (page === "fechas") return <DateSearch />;
  if (page === "buscar") return <CodeSearch />;
  if (page === "exportar") return <ExportExcel />;
  return null;
}

export default function App() {
  const [page, setPage] = useState<Page>("inicio");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <StoreProvider>
      <div className="h-full flex bg-slate-100 font-[Outfit,system-ui,sans-serif]">
        {/* Sidebar */}
        <aside
          className={`flex-shrink-0 flex flex-col bg-slate-900 text-white transition-all duration-200 ${sidebarOpen ? "w-52" : "w-14"} overflow-hidden`}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-700/60">
            <img
              src={floresLogo}
              alt="Logo Flores"
              className="w-7 h-7 rounded-full object-cover border border-slate-600/80 shadow-xs flex-shrink-0 bg-white"
            />
            {sidebarOpen && <span className="font-semibold text-sm tracking-tight whitespace-nowrap">Sistema Almacén</span>}
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors w-full text-left ${
                  page === item.id
                    ? "bg-sky-600/20 text-sky-400 border-r-2 border-sky-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center p-3 text-slate-500 hover:text-slate-300 border-t border-slate-700/60 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-5 py-6">
            <PageContent page={page} />
          </div>
        </main>
      </div>

      {/* Input base styles */}
      <style>{`
        .input {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          padding: 0.45rem 0.625rem;
          font-size: 0.875rem;
          color: #0f172a;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }
        .input:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14,165,233,0.12);
        }
        .input::placeholder { color: #94a3b8; }
        select.input { cursor: pointer; }
      `}</style>
    </StoreProvider>
  );
}
