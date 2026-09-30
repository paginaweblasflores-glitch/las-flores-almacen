import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Movement, ProductoMaestro, Traspaso, TraspasoEstado } from "../types";
import { supabase, cuentaPorAlmacen, type CuentaAlmacen } from "../supabaseClient";
import { movementFromRow, traspasoFromRow, etiquetaTraspaso } from "../store";
import { useToast } from "../toast";
import { filtrarBusqueda } from "../utils/search";
import Pager from "./Pager";

const PAGE_SIZE_DETALLE = 25;

const ESTADO_LABEL: Record<TraspasoEstado, string> = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  cancelado: "Cancelado",
};
const ESTADO_STYLE: Record<TraspasoEstado, string> = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  recibido: "bg-leaf-50 text-leaf-700 border-leaf-200",
  cancelado: "bg-stone-100 text-stone-500 border-stone-200",
};

function nombreAlmacen(almacen: string): string {
  return cuentaPorAlmacen(almacen)?.nombre ?? almacen;
}

function soles(n: number): string {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fmtFecha(iso: string): string {
  return iso.split("-").reverse().join("/");
}

// Un código "nuevo" para un almacén es el que tuvo su primer movimiento
// real AHÍ dentro del rango — no cuándo se dio de alta en el catálogo
// compartido (eso puede haber sido mucho antes, en el OTRO almacén; cada
// almacén es independiente, ver AGENTS.md). Se calcula a partir de los
// propios `movements`, no de una consulta aparte a `productos`.
interface ProductoNuevo {
  codigo: string;
  descripcion: string;
  categoria?: string;
  createdAt: string;
  almacen: string;
}

// ---- Atajos de rango de fechas ----
function inicioSemana(d: Date): Date {
  const r = new Date(d);
  const dia = r.getDay(); // 0 = domingo
  const diff = dia === 0 ? 6 : dia - 1; // lunes como inicio
  r.setDate(r.getDate() - diff);
  return r;
}

const HOY = new Date();
const PRESETS: { label: string; rango: () => [Date, Date] }[] = [
  { label: "Hoy", rango: () => [HOY, HOY] },
  { label: "Esta semana", rango: () => [inicioSemana(HOY), HOY] },
  { label: "Este mes", rango: () => [new Date(HOY.getFullYear(), HOY.getMonth(), 1), HOY] },
  {
    label: "Mes pasado",
    rango: () => [
      new Date(HOY.getFullYear(), HOY.getMonth() - 1, 1),
      new Date(HOY.getFullYear(), HOY.getMonth(), 0),
    ],
  },
  { label: "Este año", rango: () => [new Date(HOY.getFullYear(), 0, 1), HOY] },
];

// ---- Fetches directos a Supabase, sin StoreProvider (como AdminDashboard):
// la sesión del administrador tiene es_admin() = true en RLS, así que una
// consulta sin .eq("almacen", ...) ya trae filas de los dos almacenes.
// Traen el historial COMPLETO de cada almacén (sin filtrar por fecha) una
// sola vez al montar — el rango, el almacén y el producto se filtran
// después, client-side, así cambiar cualquier filtro queda instantáneo en
// vez de ir y volver a la base cada vez (mismo patrón que `AdminDashboard`
// ya usa para sus KPIs).
async function fetchMovementsFor(client: NonNullable<typeof supabase>, almacen: string): Promise<Movement[]> {
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

async function fetchTraspasosCompleto(client: NonNullable<typeof supabase>): Promise<Traspaso[]> {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("traspasos").select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map(traspasoFromRow);
}

// El catálogo MAESTRO completo (no acotado al rango) — solo para el
// buscador de "filtrar por producto"; independiente de desde/hasta, se
// trae una sola vez al montar el módulo. Ya no tiene código — la identidad
// es `id`, el código es local a cada almacén (ver fetchProductoCodigosCompleto).
async function fetchCatalogoCompleto(client: NonNullable<typeof supabase>): Promise<ProductoMaestro[]> {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("productos").select("id, descripcion, unidad_medida, categoria").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    descripcion: String(row.descripcion ?? ""),
    unidadMedida: row.unidad_medida ? String(row.unidad_medida) : undefined,
    categoria: row.categoria ? String(row.categoria) : undefined,
  }));
}

// Qué código local tiene cada almacén para cada producto del catálogo
// maestro (puede no tener ninguno). Sin filtro — se usa para resolver, una
// vez elegido un producto, con qué código filtrar los movimientos de CADA
// almacén (cada uno puede tener uno distinto, o ninguno).
interface ProductoCodigoRow {
  almacen: string;
  productoId: string;
  codigo: string;
}

async function fetchProductoCodigosCompleto(client: NonNullable<typeof supabase>): Promise<ProductoCodigoRow[]> {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("producto_codigos").select("almacen, producto_id, codigo").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((row) => ({
    almacen: String(row.almacen ?? ""),
    productoId: String(row.producto_id ?? ""),
    codigo: String(row.codigo ?? ""),
  }));
}

// Se etiqueta cada movimiento con su almacén al combinarlos — evita tener
// que "adivinar" de cuál era después, al pintar la columna Almacén.
interface MovementConAlmacen extends Movement {
  almacen: string;
}

interface Datos {
  movimientosPorAlmacen: Record<string, Movement[]>;
  traspasos: Traspaso[];
}

type DetalleTipo = "entradas" | "salidas" | "enviados" | "recibidos" | "productos" | null;

function KpiCard({
  label,
  value,
  sub,
  accent,
  onDetalle,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
  onDetalle: () => void;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col gap-2 shadow-xs">
      <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? "text-stone-900"}`}>{value.toLocaleString("es-PE")}</span>
      {sub && <span className="text-xs text-stone-400">{sub}</span>}
      <button
        type="button"
        onClick={onDetalle}
        disabled={value === 0}
        className="mt-1 self-start text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:text-stone-300 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1"
      >
        Ver detalle
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// Modal de detalle genérico: recibe las filas ya filtradas y cómo pintar
// cada una — la paginación es propia del modal, no del reporte entero.
function DetalleModal<T>({
  titulo,
  filas,
  columnas,
  renderFila,
  onClose,
}: {
  titulo: string;
  filas: T[];
  columnas: string[];
  renderFila: (item: T, i: number) => React.ReactNode;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DETALLE);
  const pageItems = filas.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-5 flex flex-col gap-4 my-8">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">{titulo}</h3>
            <p className="text-sm text-stone-400 mt-0.5">{filas.length} registro{filas.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border border-stone-200 rounded-lg overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-20rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider [&>th]:bg-stone-50 [&>th]:border-b [&>th]:border-stone-200">
                  {columnas.map((c) => (
                    <th key={c} className="text-left px-3 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">{pageItems.map((item, i) => renderFila(item, i))}</tbody>
            </table>
          </div>
          <Pager
            page={page}
            pageSize={pageSize}
            total={filas.length}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Reportes({ almacenes }: { almacenes: CuentaAlmacen[] }) {
  const toast = useToast();
  const [desde, setDesde] = useState(() => fmt(new Date(HOY.getFullYear(), HOY.getMonth(), 1)));
  const [hasta, setHasta] = useState(() => fmt(HOY));
  const [almacenFiltro, setAlmacenFiltro] = useState<string>("todos");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [detalle, setDetalle] = useState<DetalleTipo>(null);
  const [descargando, setDescargando] = useState(false);

  // ---- Filtro por producto (opcional): busca por NOMBRE en el catálogo
  // maestro completo (ya no por código — cada almacén tiene el suyo, ver
  // ProductoCodigoRow), se trae una sola vez al montar (no depende del
  // rango de fechas).
  const [catalogo, setCatalogo] = useState<ProductoMaestro[]>([]);
  const [productoCodigos, setProductoCodigos] = useState<ProductoCodigoRow[]>([]);
  const [productoId, setProductoId] = useState<string | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [resultadosAbiertos, setResultadosAbiertos] = useState(false);
  const buscadorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([fetchCatalogoCompleto(supabase), fetchProductoCodigosCompleto(supabase)])
      .then(([cat, codigos]) => {
        setCatalogo(cat);
        setProductoCodigos(codigos);
      })
      .catch((e) => console.error("Error cargando el catálogo para el buscador:", e));
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target as Node)) setResultadosAbiertos(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // ${almacen}::${productoId} -> código local de ese almacén para ese
  // producto (si lo tiene).
  const codigoPorAlmacenYProducto = useMemo(() => {
    const m = new Map<string, string>();
    for (const pc of productoCodigos) m.set(`${pc.almacen}::${pc.productoId}`, pc.codigo);
    return m;
  }, [productoCodigos]);

  const productoSeleccionado = useMemo(
    () => (productoId ? catalogo.find((p) => p.id === productoId) : undefined),
    [catalogo, productoId],
  );

  const resultadosProducto = useMemo(
    () => filtrarBusqueda(catalogo, busquedaProducto, () => "", (p) => p.descripcion).slice(0, 20),
    [catalogo, busquedaProducto],
  );

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelado = false;

    (async () => {
      setCargando(true);
      try {
        const [movsPorAlmacen, traspasos] = await Promise.all([
          Promise.all(almacenes.map((c) => fetchMovementsFor(client, c.almacen))),
          fetchTraspasosCompleto(client),
        ]);
        if (cancelado) return;
        const movimientosPorAlmacen: Record<string, Movement[]> = {};
        almacenes.forEach((c, idx) => {
          movimientosPorAlmacen[c.almacen] = movsPorAlmacen[idx];
        });
        setDatos({ movimientosPorAlmacen, traspasos });
      } catch (e) {
        console.error("Error cargando el reporte:", e);
        toast.error("No se pudo cargar el reporte. Revisa tu conexión.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacenes, toast]);

  const movimientos = useMemo(() => {
    if (!datos) return [] as MovementConAlmacen[];
    // El producto elegido puede tener un código LOCAL distinto (o ninguno)
    // en cada almacén — se resuelve por separado para cada uno, no es un
    // único código comparable entre los dos.
    const etiquetados = (almacen: string): MovementConAlmacen[] => {
      let ms = (datos.movimientosPorAlmacen[almacen] ?? []).filter((m) => m.fecha >= desde && m.fecha <= hasta);
      if (productoId) {
        const codigo = codigoPorAlmacenYProducto.get(`${almacen}::${productoId}`);
        ms = codigo ? ms.filter((m) => m.codigo.toUpperCase().trim() === codigo) : [];
      }
      return ms.map((m) => ({ ...m, almacen }));
    };
    return almacenFiltro === "todos" ? almacenes.flatMap((c) => etiquetados(c.almacen)) : etiquetados(almacenFiltro);
  }, [datos, almacenFiltro, almacenes, productoId, codigoPorAlmacenYProducto, desde, hasta]);

  const entradas = useMemo(() => movimientos.filter((m) => m.tipo === "Entrada"), [movimientos]);
  const salidas = useMemo(() => movimientos.filter((m) => m.tipo === "Salida"), [movimientos]);
  const unidadesEntradas = entradas.reduce((s, m) => s + m.cantidad, 0);
  const unidadesSalidas = salidas.reduce((s, m) => s + m.cantidad, 0);
  const valorEntradas = entradas.reduce((s, m) => s + m.valor, 0);
  const valorSalidas = salidas.reduce((s, m) => s + m.valor, 0);

  const enviados = useMemo(() => {
    if (!datos) return [] as Traspaso[];
    return datos.traspasos.filter(
      (t) =>
        (almacenFiltro === "todos" || t.almacenOrigen === almacenFiltro) &&
        t.fechaEnvio >= desde &&
        t.fechaEnvio <= hasta &&
        (!productoId || t.items.some((it) => it.productoId === productoId)),
    );
  }, [datos, almacenFiltro, desde, hasta, productoId]);

  const recibidos = useMemo(() => {
    if (!datos) return [] as Traspaso[];
    return datos.traspasos.filter(
      (t) =>
        (almacenFiltro === "todos" || t.almacenDestino === almacenFiltro) &&
        t.estado === "recibido" &&
        !!t.fechaRecepcion &&
        t.fechaRecepcion >= desde &&
        t.fechaRecepcion <= hasta &&
        (!productoId || t.items.some((it) => it.productoId === productoId)),
    );
  }, [datos, almacenFiltro, desde, hasta, productoId]);

  // "Nuevo" es el primer movimiento real de ese código EN ESE ALMACÉN — no
  // cuándo se dio de alta en el catálogo compartido (que puede ser mucho
  // antes, del otro lado). Se calcula agrupando los propios movimientos.
  const productosNuevos = useMemo(() => {
    if (!datos) return [] as ProductoNuevo[];
    const almacenesAConsiderar = almacenFiltro === "todos" ? almacenes.map((c) => c.almacen) : [almacenFiltro];
    const resultado: ProductoNuevo[] = [];
    for (const almacen of almacenesAConsiderar) {
      // Si hay un producto elegido, este almacén puede no tener ningún
      // código local para él (nunca lo movió) — en ese caso no aporta nada.
      const codigoFiltro = productoId ? codigoPorAlmacenYProducto.get(`${almacen}::${productoId}`) : undefined;
      if (productoId && !codigoFiltro) continue;
      const primeros = new Map<string, Movement>();
      for (const m of datos.movimientosPorAlmacen[almacen] ?? []) {
        if (!m.createdAt) continue;
        const key = m.codigo.toUpperCase().trim();
        const actual = primeros.get(key);
        if (!actual || m.createdAt < (actual.createdAt ?? "")) primeros.set(key, m);
      }
      for (const [codigo, m] of primeros) {
        const fechaAlta = (m.createdAt ?? "").split("T")[0];
        if (fechaAlta < desde || fechaAlta > hasta) continue;
        if (codigoFiltro && codigo !== codigoFiltro) continue;
        resultado.push({ codigo, descripcion: m.descripcion, categoria: m.categoria, createdAt: m.createdAt!, almacen });
      }
    }
    return resultado;
  }, [datos, almacenFiltro, almacenes, desde, hasta, productoId, codigoPorAlmacenYProducto]);

  function aplicarPreset(rango: () => [Date, Date]) {
    const [d, h] = rango();
    setDesde(fmt(d));
    setHasta(fmt(h));
  }

  const mostrarAlmacenCol = almacenFiltro === "todos";
  const sufijoProducto = productoSeleccionado ? ` · ${productoSeleccionado.descripcion}` : "";
  const nombreAlmacenFiltro = almacenFiltro === "todos" ? "Los dos almacenes" : nombreAlmacen(almacenFiltro);

  // El PDF refleja exactamente lo que se está mirando en pantalla — mismo
  // rango, almacén y producto que los filtros de arriba, no una foto aparte.
  function descargarPdf() {
    setDescargando(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const generatedAt = new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });

      doc.setFillColor(41, 37, 36);
      doc.rect(0, 0, pageWidth, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Reporte — Sistema Almacén", 14, 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Generado el ${generatedAt}`, 14, 16);

      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${fmtFecha(desde)} al ${fmtFecha(hasta)}`, 14, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `Almacén: ${nombreAlmacenFiltro}${productoSeleccionado ? ` · Producto: ${productoSeleccionado.descripcion}` : ""}`,
        14,
        36,
      );

      autoTable(doc, {
        startY: 42,
        head: [["Indicador", "Valor"]],
        body: [
          ["Entradas", `${entradas.length} (${unidadesEntradas.toLocaleString("es-PE")} unidades, S/ ${soles(valorEntradas)})`],
          ["Salidas", `${salidas.length} (${unidadesSalidas.toLocaleString("es-PE")} unidades, S/ ${soles(valorSalidas)})`],
          ["Productos nuevos", String(productosNuevos.length)],
          ["Traspasos enviados", String(enviados.length)],
          ["Traspasos recibidos", String(recibidos.length)],
        ],
        theme: "grid",
        headStyles: { fillColor: [200, 55, 42] },
        styles: { fontSize: 9 },
      });

      doc.save(`reporte_${desde}_a_${hasta}.pdf`);
    } catch (e) {
      console.error("Error generando el reporte:", e);
      toast.error("No se pudo generar el reporte.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Reportes</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Elige un rango de fechas, un almacén y, si querés acotar a un solo producto, buscalo abajo.
          </p>
        </div>
        <button
          onClick={descargarPdf}
          disabled={!datos || descargando}
          className="btn-brand flex items-center gap-2 px-4 py-2 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-4.414-4.414A1 1 0 0012.586 4H7a2 2 0 00-2 2v13a2 2 0 002 2z" />
          </svg>
          {descargando ? "Generando…" : "Descargar reporte"}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => aplicarPreset(p.rango)}
              className="px-3 py-1.5 text-xs font-semibold text-stone-600 border border-stone-200 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="rep-desde" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Desde
            </label>
            <input
              id="rep-desde"
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rep-hasta" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Hasta
            </label>
            <input
              id="rep-hasta"
              type="date"
              value={hasta}
              min={desde}
              max={fmt(HOY)}
              onChange={(e) => setHasta(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rep-almacen" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Almacén
            </label>
            <select
              id="rep-almacen"
              value={almacenFiltro}
              onChange={(e) => setAlmacenFiltro(e.target.value)}
              className="input"
            >
              <option value="todos">Los dos almacenes</option>
              {almacenes.map((c) => (
                <option key={c.almacen} value={c.almacen}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1" ref={buscadorRef}>
          <label htmlFor="rep-producto" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Producto <span className="text-stone-400 font-normal lowercase">(opcional — deja vacío para ver todos)</span>
          </label>
          {productoSeleccionado ? (
            <div className="flex items-center justify-between gap-2 border border-leaf-200 bg-leaf-50 rounded-lg px-3 py-2 max-w-md">
              <span className="text-sm text-stone-800 truncate">{productoSeleccionado.descripcion}</span>
              <button
                type="button"
                onClick={() => {
                  setProductoId(null);
                  setBusquedaProducto("");
                }}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex-shrink-0 cursor-pointer"
              >
                Quitar
              </button>
            </div>
          ) : (
            <div className="relative max-w-md">
              <input
                id="rep-producto"
                value={busquedaProducto}
                onChange={(e) => {
                  setBusquedaProducto(e.target.value);
                  setResultadosAbiertos(true);
                }}
                onFocus={() => setResultadosAbiertos(true)}
                placeholder="Buscar por nombre…"
                autoComplete="off"
                className="input"
              />
              {resultadosAbiertos && busquedaProducto && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                  {resultadosProducto.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-stone-400">Ningún producto coincide.</p>
                  ) : (
                    resultadosProducto.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setProductoId(p.id);
                          setResultadosAbiertos(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50 border-b border-stone-50 last:border-0 cursor-pointer"
                      >
                        <span className="truncate">{p.descripcion}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {cargando && !datos ? (
        <p className="text-sm text-stone-400">Cargando reporte…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              label="Entradas"
              value={entradas.length}
              sub={`${unidadesEntradas.toLocaleString("es-PE")} unidades · S/ ${soles(valorEntradas)}`}
              accent="text-leaf-600"
              onDetalle={() => setDetalle("entradas")}
            />
            <KpiCard
              label="Salidas"
              value={salidas.length}
              sub={`${unidadesSalidas.toLocaleString("es-PE")} unidades · S/ ${soles(valorSalidas)}`}
              accent="text-brand-600"
              onDetalle={() => setDetalle("salidas")}
            />
            <KpiCard label="Productos nuevos" value={productosNuevos.length} onDetalle={() => setDetalle("productos")} />
            <KpiCard label="Traspasos enviados" value={enviados.length} onDetalle={() => setDetalle("enviados")} />
            <KpiCard label="Traspasos recibidos" value={recibidos.length} onDetalle={() => setDetalle("recibidos")} />
          </div>

          {cargando && <p className="text-xs text-stone-400">Actualizando…</p>}
        </>
      )}

      {detalle === "entradas" && (
        <DetalleModal
          titulo={`Entradas — ${fmtFecha(desde)} al ${fmtFecha(hasta)}${sufijoProducto}`}
          filas={entradas}
          columnas={["Código", "Producto", "Cantidad", "Fecha", "Responsable", "Área", ...(mostrarAlmacenCol ? ["Almacén"] : [])]}
          onClose={() => setDetalle(null)}
          renderFila={(m: MovementConAlmacen) => (
            <tr key={m.id}>
              <td className="px-3 py-2 font-mono text-xs text-brand-700">{m.codigo}</td>
              <td className="px-3 py-2 text-stone-700">{m.descripcion}</td>
              <td className="px-3 py-2 font-mono text-stone-700">
                {m.cantidad} {m.unidadMedida}
              </td>
              <td className="px-3 py-2 text-stone-500">{fmtFecha(m.fecha)}</td>
              <td className="px-3 py-2 text-stone-500">{m.responsable}</td>
              <td className="px-3 py-2 text-stone-500">{m.area}</td>
              {mostrarAlmacenCol && <td className="px-3 py-2 text-stone-500">{nombreAlmacen(m.almacen)}</td>}
            </tr>
          )}
        />
      )}

      {detalle === "salidas" && (
        <DetalleModal
          titulo={`Salidas — ${fmtFecha(desde)} al ${fmtFecha(hasta)}${sufijoProducto}`}
          filas={salidas}
          columnas={["Código", "Producto", "Cantidad", "Fecha", "Responsable", "Área", ...(mostrarAlmacenCol ? ["Almacén"] : [])]}
          onClose={() => setDetalle(null)}
          renderFila={(m: MovementConAlmacen) => (
            <tr key={m.id}>
              <td className="px-3 py-2 font-mono text-xs text-brand-700">{m.codigo}</td>
              <td className="px-3 py-2 text-stone-700">{m.descripcion}</td>
              <td className="px-3 py-2 font-mono text-stone-700">
                {m.cantidad} {m.unidadMedida}
              </td>
              <td className="px-3 py-2 text-stone-500">{fmtFecha(m.fecha)}</td>
              <td className="px-3 py-2 text-stone-500">{m.responsable}</td>
              <td className="px-3 py-2 text-stone-500">{m.area}</td>
              {mostrarAlmacenCol && <td className="px-3 py-2 text-stone-500">{nombreAlmacen(m.almacen)}</td>}
            </tr>
          )}
        />
      )}

      {detalle === "productos" && (
        <DetalleModal
          titulo={`Productos nuevos — ${fmtFecha(desde)} al ${fmtFecha(hasta)}${sufijoProducto}`}
          filas={productosNuevos}
          columnas={["Código", "Producto", "Categoría", "Fecha de alta", ...(mostrarAlmacenCol ? ["Almacén"] : [])]}
          onClose={() => setDetalle(null)}
          renderFila={(p: ProductoNuevo) => (
            <tr key={`${p.almacen}-${p.codigo}`}>
              <td className="px-3 py-2 font-mono text-xs text-brand-700">{p.codigo}</td>
              <td className="px-3 py-2 text-stone-700">{p.descripcion}</td>
              <td className="px-3 py-2 text-stone-500">{p.categoria ?? "—"}</td>
              <td className="px-3 py-2 text-stone-500">{fmtFecha(p.createdAt.split("T")[0])}</td>
              {mostrarAlmacenCol && <td className="px-3 py-2 text-stone-500">{nombreAlmacen(p.almacen)}</td>}
            </tr>
          )}
        />
      )}

      {(detalle === "enviados" || detalle === "recibidos") && (
        <DetalleModal
          titulo={
            detalle === "enviados"
              ? `Traspasos enviados — ${fmtFecha(desde)} al ${fmtFecha(hasta)}${sufijoProducto}`
              : `Traspasos recibidos — ${fmtFecha(desde)} al ${fmtFecha(hasta)}${sufijoProducto}`
          }
          filas={detalle === "enviados" ? enviados : recibidos}
          columnas={["N°", "Fecha", "Origen → Destino", "Ítems", "Estado"]}
          onClose={() => setDetalle(null)}
          renderFila={(t: Traspaso) => (
            <tr key={t.id}>
              <td className="px-3 py-2 font-mono text-xs font-semibold text-stone-600">{etiquetaTraspaso(t)}</td>
              <td className="px-3 py-2 text-stone-500">
                {fmtFecha(detalle === "enviados" ? t.fechaEnvio : t.fechaRecepcion ?? t.fechaEnvio)}
              </td>
              <td className="px-3 py-2 text-stone-700">
                {nombreAlmacen(t.almacenOrigen)} <span className="text-stone-300">→</span> {nombreAlmacen(t.almacenDestino)}
              </td>
              <td className="px-3 py-2 font-mono text-stone-600">{t.items.length}</td>
              <td className="px-3 py-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${ESTADO_STYLE[t.estado]}`}>
                  {ESTADO_LABEL[t.estado]}
                </span>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}
