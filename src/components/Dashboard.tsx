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
  const { movements, inventory, categories } = useStore();
  const today = new Date().toISOString().split("T")[0];

  const totalProducts = inventory.length;
  const totalUnits = inventory.reduce((s, i) => s + i.cantidadDisponible, 0);
  const totalEntradas = movements.filter((m) => m.tipo === "Entrada").length;
  const totalSalidas = movements.filter((m) => m.tipo === "Salida").length;
  const todayMoves = movements.filter((m) => m.fecha === today).length;

  // Agrupar productos por categoría
  const allCategories = categories;
  const byCategory = inventory.reduce<Record<string, { count: number; units: number }>>((acc, item) => {
    const cat = item.categoria || "Sin categoría";
    if (!acc[cat]) acc[cat] = { count: 0, units: 0 };
    acc[cat].count++;
    acc[cat].units += item.cantidadDisponible;
    return acc;
  }, {});

  // Aseguramos que todas las categorías aparezcan aunque no tengan productos
  const categoryRows = allCategories.map((cat) => ({
    name: cat,
    count: byCategory[cat]?.count ?? 0,
    units: byCategory[cat]?.units ?? 0,
  }));

  const noStockItems = inventory.filter((i) => i.cantidadDisponible <= 0);

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

      {/* Productos por categoría — siempre visible */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Productos por categoría</h2>
        </div>
        {categoryRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400 text-center">No hay categorías registradas.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {categoryRows.map(({ name, count, units }) => (
              <div key={name} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full font-medium">
                    {name}
                  </span>
                  <span className="text-sm text-slate-500">
                    {count === 0 ? "Sin productos" : `${count} producto${count !== 1 ? "s" : ""}`}
                  </span>
                </div>
                <span className={`text-sm font-semibold ${count === 0 ? "text-slate-300" : "text-slate-700"}`}>
                  {units.toLocaleString()} uds.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Productos sin stock — siempre visible */}
      <div className={`border rounded-xl overflow-hidden ${noStockItems.length > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
        <div className={`px-5 py-3.5 border-b flex items-center gap-2 ${noStockItems.length > 0 ? "border-rose-200" : "border-slate-100"}`}>
          <svg className={`w-4 h-4 ${noStockItems.length > 0 ? "text-rose-600" : "text-slate-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h2 className={`text-sm font-bold uppercase tracking-wider ${noStockItems.length > 0 ? "text-rose-700" : "text-slate-800"}`}>
            Productos sin stock
          </h2>
          {noStockItems.length > 0 && (
            <span className="ml-auto text-xs bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-semibold">
              {noStockItems.length}
            </span>
          )}
        </div>
        {noStockItems.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">
            ✅ Todos los productos tienen stock disponible.
          </p>
        ) : (
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {noStockItems.map((i) => (
              <span key={i.codigo} className="text-xs bg-white border border-rose-200 text-rose-700 px-2 py-0.5 rounded font-mono">
                {i.codigo} — {i.descripcion}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
