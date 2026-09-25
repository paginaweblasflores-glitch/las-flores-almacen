import { useEffect, useState } from "react";
import { supabase, CUENTAS, type CuentaAlmacen } from "../supabaseClient";
import { buildInventory, movementFromRow } from "../store";
import { useToast } from "../toast";
import AdminConfiguracion from "./AdminConfiguracion";
import Reportes from "./Reportes";

function soles(n: number): string {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Trae TODOS los movimientos de un almacén (paginado, igual que store.tsx),
// sin pasar por StoreProvider — este panel necesita los dos almacenes a la
// vez, no uno solo.
async function fetchMovementsFor(client: NonNullable<typeof supabase>, almacen: string) {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("movements").select("*").eq("almacen", almacen).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map(movementFromRow);
}

// El catálogo compartido (sin filtro por almacén, es la misma tabla para
// los dos) — se pasa a buildInventory de cada almacén para que un almacén
// que todavía no movió un producto lo cuente igual, con 0 de stock.
async function fetchCatalogo(client: NonNullable<typeof supabase>) {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("productos").select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((row) => ({
    codigo: String(row.codigo ?? ""),
    descripcion: String(row.descripcion ?? ""),
    unidadMedida: row.unidad_medida ? String(row.unidad_medida) : undefined,
    categoria: row.categoria ? String(row.categoria) : undefined,
    imagen: row.imagen ? String(row.imagen) : undefined,
  }));
}

interface AlmacenStats {
  cuenta: CuentaAlmacen;
  totalProductos: number;
  totalUnidades: number;
  valorInventario: number;
  porReponer: number;
  sinStock: number;
  traspasosPendientes: number;
}

function KPI({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</span>
      <span className={`text-xl font-bold ${accent ?? "text-stone-900"}`}>{value}</span>
    </div>
  );
}

export default function AdminDashboard({
  cuenta,
  onEntrar,
  onLogout,
}: {
  cuenta: CuentaAlmacen;
  onEntrar: (almacen: string) => void;
  onLogout: () => void;
}) {
  const toast = useToast();
  const [stats, setStats] = useState<AlmacenStats[] | null>(null);
  const [vista, setVista] = useState<"resumen" | "reportes" | "configuracion">("resumen");

  const almacenes = CUENTAS.filter((c) => !c.esAdmin);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelado = false;

    (async () => {
      try {
        const [movsPorAlmacen, traspasosRes, catalogo] = await Promise.all([
          Promise.all(almacenes.map((c) => fetchMovementsFor(client, c.almacen))),
          client.from("traspasos").select("almacen_destino").eq("estado", "pendiente"),
          fetchCatalogo(client),
        ]);
        if (cancelado) return;
        if (traspasosRes.error) throw traspasosRes.error;

        const pendientesPorAlmacen = new Map<string, number>();
        for (const row of traspasosRes.data ?? []) {
          const key = String(row.almacen_destino);
          pendientesPorAlmacen.set(key, (pendientesPorAlmacen.get(key) ?? 0) + 1);
        }

        const nuevo: AlmacenStats[] = almacenes.map((c, idx) => {
          const movements = movsPorAlmacen[idx];
          const inventory = Array.from(buildInventory(movements, catalogo).values());
          const valorInventario = inventory.reduce((s, i) => s + Math.max(0, i.cantidadDisponible) * i.costo, 0);
          const porReponer = inventory.filter(
            (i) => i.stockMinimo > 0 && i.cantidadDisponible > 0 && i.cantidadDisponible <= i.stockMinimo,
          ).length;
          const sinStock = inventory.filter((i) => i.cantidadDisponible <= 0).length;
          return {
            cuenta: c,
            totalProductos: inventory.length,
            totalUnidades: inventory.reduce((s, i) => s + i.cantidadDisponible, 0),
            valorInventario,
            porReponer,
            sinStock,
            traspasosPendientes: pendientesPorAlmacen.get(c.almacen) ?? 0,
          };
        });
        setStats(nuevo);
      } catch (e) {
        console.error("Error cargando estadísticas del panel de administrador:", e);
        toast.error("No se pudieron cargar las estadísticas de los almacenes.");
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  return (
    <div className="h-full flex flex-col bg-canvas overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-shell text-white px-4 sm:px-6 py-3.5 flex-shrink-0">
        <img src={cuenta.logo} alt={cuenta.nombre} className="w-9 h-9 flex-shrink-0 rounded-full bg-white object-cover" />
        <div className="flex flex-col leading-tight">
          <span className="font-serif font-semibold text-[15px] tracking-tight">{cuenta.nombre}</span>
          <span className="text-[11px] text-white/45">Sistema Almacén</span>
        </div>
        <button
          onClick={() => setVista(vista === "reportes" ? "resumen" : "reportes")}
          title="Reportes"
          className="ml-auto flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V9m6 8V5m-11 12h16M4 12l4-4 4 3 5-6" />
          </svg>
          <span className="hidden sm:inline">Reportes</span>
        </button>
        <button
          onClick={() => setVista(vista === "configuracion" ? "resumen" : "configuracion")}
          title="Configuración"
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Configuración</span>
        </button>
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          className="flex items-center gap-2 text-sm text-white/60 hover:text-brand-300 transition-colors cursor-pointer"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>

      {vista === "configuracion" ? (
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
          <button
            onClick={() => setVista("resumen")}
            className="self-start text-sm text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al resumen
          </button>
          <AdminConfiguracion cuentas={almacenes} />
        </div>
      ) : vista === "reportes" ? (
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
          <button
            onClick={() => setVista("resumen")}
            className="self-start text-sm text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al resumen
          </button>
          <Reportes almacenes={almacenes} />
        </div>
      ) : (
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Panel de {cuenta.nombre}</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Resumen de los {almacenes.length} almacenes. Elige uno para entrar a su panel completo.
          </p>
        </div>

        {!stats ? (
          <p className="text-sm text-stone-400">Cargando estadísticas…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {stats.map((s) => (
              <div key={s.cuenta.almacen} className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <img
                    src={s.cuenta.logo}
                    alt={s.cuenta.nombre}
                    className="w-10 h-10 flex-shrink-0 rounded-full bg-white border border-stone-200 object-cover"
                  />
                  <h2 className="text-base font-bold text-stone-900">{s.cuenta.nombre}</h2>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <KPI label="Productos" value={s.totalProductos} />
                  <KPI label="Unidades" value={s.totalUnidades.toLocaleString("es-PE")} />
                  <KPI label="Por reponer" value={s.porReponer} accent={s.porReponer > 0 ? "text-amber-600" : undefined} />
                  <KPI label="Sin stock" value={s.sinStock} accent={s.sinStock > 0 ? "text-brand-600" : undefined} />
                  <KPI
                    label="Traspasos pendientes"
                    value={s.traspasosPendientes}
                    accent={s.traspasosPendientes > 0 ? "text-amber-600" : undefined}
                  />
                </div>

                <p className="text-xs text-stone-400">Valor de inventario: S/ {soles(s.valorInventario)}</p>

                <button
                  type="button"
                  onClick={() => onEntrar(s.cuenta.almacen)}
                  className="mt-auto self-start px-4 py-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                >
                  Entrar al panel de {s.cuenta.nombre}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
