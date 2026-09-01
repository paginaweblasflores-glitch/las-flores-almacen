import { useStore } from "../store";

function KPICard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-1 shadow-xs">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const { movements, inventory } = useStore();
  const today = new Date().toISOString().split("T")[0];

  const totalProducts = inventory.length;
  const totalUnits = inventory.reduce((s, i) => s + i.cantidadDisponible, 0);
  const totalEntradas = movements.filter((m) => m.tipo === "Entrada").length;
  const totalSalidas = movements.filter((m) => m.tipo === "Salida").length;
  const todayMoves = movements.filter((m) => m.fecha === today).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel Principal</h1>
        <p className="text-sm text-slate-400 mt-0.5">Resumen general del estado del almacén</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Productos" value={totalProducts} sub="registrados" />
        <KPICard label="Unidades" value={totalUnits.toLocaleString()} sub="disponibles" />
        <KPICard label="Entradas" value={totalEntradas} sub="registros" accent="text-emerald-600" />
        <KPICard label="Salidas" value={totalSalidas} sub="registros" accent="text-rose-500" />
        <KPICard label="Hoy" value={todayMoves} sub={`movimientos (${today.split("-").reverse().join("/")})`} accent="text-sky-600" />
      </div>

      {/* Quick stats by category */}
      {inventory.length > 0 && (() => {
        const byCategory = inventory.reduce<Record<string, { count: number; units: number }>>((acc, item) => {
          const cat = item.categoria || "Sin categoría";
          if (!acc[cat]) acc[cat] = { count: 0, units: 0 };
          acc[cat].count++;
          acc[cat].units += item.cantidadDisponible;
          return acc;
        }, {});
        const entries = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count);
        return (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Productos por categoría</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {entries.map(([cat, data]) => (
                <div key={cat} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full font-medium">
                      {cat}
                    </span>
                    <span className="text-sm text-slate-600">{data.count} producto{data.count !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{data.units.toLocaleString()} uds.</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Low stock alert */}
      {inventory.filter((i) => i.cantidadDisponible <= 0).length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span className="text-sm font-semibold text-rose-700">Productos sin stock</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {inventory.filter((i) => i.cantidadDisponible <= 0).map((i) => (
              <span key={i.codigo} className="text-xs bg-white border border-rose-200 text-rose-700 px-2 py-0.5 rounded font-mono">
                {i.codigo} — {i.descripcion}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
