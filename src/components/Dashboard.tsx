import { useState } from "react";
import { useStore } from "../store";
import { AVISOS_VOLUMEN, type NivelAviso } from "../types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = "#c8372a";
const LEAF = "#3f7e2f";

const AVISO_ESTILO: Record<NivelAviso, string> = {
  info: "bg-stone-50 border-stone-300 text-stone-700",
  warn: "bg-amber-50 border-amber-300 text-amber-800",
  error: "bg-brand-50 border-brand-300 text-brand-800",
};

function soles(n: number): string {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KPICard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="report-section bg-white border border-stone-200 rounded-lg p-4 flex flex-col gap-1 shadow-xs">
      <span className="text-xs font-medium uppercase tracking-wider text-stone-400">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? "text-stone-900"}`}>{value}</span>
      {sub && <span className="text-xs text-stone-400">{sub}</span>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="report-section bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100">
        <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

async function loadImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Dashboard() {
  const { movements, inventory, categories } = useStore();
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // ---- Aviso por volumen de datos ----
  const [avisosCerrados, setAvisosCerrados] = useState<Record<number, boolean>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("avisos-volumen-cerrados") || "{}");
    } catch {
      return {};
    }
  });
  const avisoVolumen = [...AVISOS_VOLUMEN].reverse().find((a) => movements.length >= a.limite);
  const mostrarAviso = avisoVolumen && !avisosCerrados[avisoVolumen.limite];
  function cerrarAviso() {
    if (!avisoVolumen) return;
    const next = { ...avisosCerrados, [avisoVolumen.limite]: true };
    setAvisosCerrados(next);
    try {
      sessionStorage.setItem("avisos-volumen-cerrados", JSON.stringify(next));
    } catch {
      /* sessionStorage no disponible */
    }
  }

  // ---- Valores base ----
  const valorStock = (i: (typeof inventory)[number]) => Math.max(0, i.cantidadDisponible) * i.costo;
  const totalProductos = inventory.length;
  const totalUnidades = inventory.reduce((s, i) => s + i.cantidadDisponible, 0);
  const valorInventario = inventory.reduce((s, i) => s + valorStock(i), 0);

  const entradas = movements.filter((m) => m.tipo === "Entrada");
  const salidas = movements.filter((m) => m.tipo === "Salida");
  const valorEntradas = entradas.reduce((s, m) => s + m.valor, 0);
  const valorSalidas = salidas.reduce((s, m) => s + m.valor, 0);
  const todayMoves = movements.filter((m) => m.fecha === today).length;

  const porReponer = inventory.filter(
    (i) => i.stockMinimo > 0 && i.cantidadDisponible > 0 && i.cantidadDisponible <= i.stockMinimo
  );
  const sinStock = inventory.filter((i) => i.cantidadDisponible <= 0);

  // ---- Por categoría ----
  const porCategoria = categories
    .map((name) => {
      const items = inventory.filter((i) => (i.categoria || "Sin categoría") === name);
      return {
        name,
        productos: items.length,
        unidades: items.reduce((s, i) => s + i.cantidadDisponible, 0),
        valor: items.reduce((s, i) => s + valorStock(i), 0),
      };
    })
    .filter((r) => r.productos > 0)
    .sort((a, b) => b.valor - a.valor);

  // ---- Por área ----
  const areasMap = new Map<string, { productos: number; unidades: number; valor: number }>();
  for (const i of inventory) {
    const a = i.area || "Sin área";
    const cur = areasMap.get(a) ?? { productos: 0, unidades: 0, valor: 0 };
    cur.productos += 1;
    cur.unidades += i.cantidadDisponible;
    cur.valor += valorStock(i);
    areasMap.set(a, cur);
  }
  const porArea = Array.from(areasMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.valor - a.valor);

  // ---- Movimientos por mes (últimos 6) ----
  const meses: { key: string; label: string }[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    meses.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` });
  }
  const porMes = meses.map(({ key, label }) => {
    const ent = entradas.filter((m) => m.fecha.slice(0, 7) === key);
    const sal = salidas.filter((m) => m.fecha.slice(0, 7) === key);
    return {
      label,
      Entradas: ent.length,
      Salidas: sal.length,
      valorEnt: ent.reduce((s, m) => s + m.valor, 0),
      valorSal: sal.reduce((s, m) => s + m.valor, 0),
    };
  });

  // ---- Top 10 productos por valor en stock ----
  const topProductos = [...inventory]
    .map((i) => ({ ...i, valorStock: valorStock(i) }))
    .sort((a, b) => b.valorStock - a.valorStock)
    .slice(0, 10);

  async function descargarPdf() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedAt = now.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });

    // ---- Encabezado de marca ----
    doc.setFillColor(200, 55, 42);
    doc.rect(0, 0, pageWidth, 26, "F");

    const logoDataUrl = await loadImageAsDataURL("/logo.png").catch(() => null);
    if (logoDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.circle(18, 13, 8.5, "F");
      doc.addImage(logoDataUrl, "PNG", 11, 6, 14, 14);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Reporte de Almacén", 32, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Restaurante Las Flores", 32, 18);
    doc.setFontSize(7.5);
    doc.text(`Generado el ${generatedAt}`, 32, 23);

    autoTable(doc, {
      startY: 33,
      head: [["Indicador", "Valor", "Detalle"]],
      body: [
        ["Productos", String(totalProductos), "registrados"],
        ["Unidades", totalUnidades.toLocaleString("es-PE"), "en stock"],
        ["Valor inventario", `S/ ${soles(valorInventario)}`, "stock x costo"],
        ["Entradas", String(entradas.length), `S/ ${soles(valorEntradas)}`],
        ["Salidas", String(salidas.length), `S/ ${soles(valorSalidas)}`],
        ["Por reponer", String(porReponer.length + sinStock.length), `${sinStock.length} sin stock`],
      ],
      theme: "grid",
      headStyles: { fillColor: [200, 55, 42] },
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      head: [["Categoria", "Productos", "Unidades", "Valor (S/)", "% del total"]],
      body: porCategoria.map((r) => [
        r.name,
        String(r.productos),
        r.unidades.toLocaleString("es-PE"),
        soles(r.valor),
        `${valorInventario > 0 ? ((r.valor / valorInventario) * 100).toFixed(1) : "0.0"}%`,
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 55, 42] },
      styles: { fontSize: 8 },
      margin: { top: 14 },
    });

    autoTable(doc, {
      head: [["Mes", "Entradas", "S/ Entradas", "Salidas", "S/ Salidas"]],
      body: porMes.map((r) => [r.label, String(r.Entradas), soles(r.valorEnt), String(r.Salidas), soles(r.valorSal)]),
      theme: "grid",
      headStyles: { fillColor: [63, 126, 47] },
      styles: { fontSize: 8 },
      margin: { top: 14 },
    });

    autoTable(doc, {
      head: [["Area", "Productos", "Unidades", "Valor (S/)"]],
      body: porArea.map((r) => [r.name, String(r.productos), r.unidades.toLocaleString("es-PE"), soles(r.valor)]),
      theme: "grid",
      headStyles: { fillColor: [100, 100, 100] },
      styles: { fontSize: 8 },
      margin: { top: 14 },
    });

    autoTable(doc, {
      head: [["Codigo", "Producto", "Disponible", "Costo unit.", "Valor en stock (S/)"]],
      body: topProductos.map((i) => [
        i.codigo,
        i.descripcion,
        `${i.cantidadDisponible} ${i.unidadMedida || ""}`.trim(),
        soles(i.costo),
        soles(i.valorStock),
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 55, 42] },
      styles: { fontSize: 8 },
      margin: { top: 14 },
    });

    if (porReponer.length > 0) {
      autoTable(doc, {
        head: [["Codigo", "Producto", "Disponible", "Minimo", "Area"]],
        body: porReponer.map((i) => [i.codigo, i.descripcion, `${i.cantidadDisponible} ${i.unidadMedida || ""}`.trim(), String(i.stockMinimo), i.area]),
        theme: "grid",
        headStyles: { fillColor: [217, 142, 24] },
        styles: { fontSize: 8 },
        margin: { top: 14 },
      });
    }

    if (sinStock.length > 0) {
      autoTable(doc, {
        head: [["Codigo", "Producto", "Area"]],
        body: sinStock.map((i) => [i.codigo, i.descripcion, i.area]),
        theme: "grid",
        headStyles: { fillColor: [200, 55, 42] },
        styles: { fontSize: 8 },
        margin: { top: 14 },
      });
    }

    // ---- Pie de página con numeración ----
    const pageCount = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(230, 225, 219);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
      doc.setFontSize(7.5);
      doc.setTextColor(139, 130, 121);
      doc.setFont("helvetica", "normal");
      doc.text("Sistema Almacén · Restaurante Las Flores", 14, pageHeight - 7);
      doc.text(`Página ${p} de ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: "right" });
    }

    doc.save(`reporte_almacen_${today}.pdf`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso por volumen de datos */}
      {mostrarAviso && avisoVolumen && (
        <div className={`no-print flex items-start gap-3 rounded-xl border p-4 ${AVISO_ESTILO[avisoVolumen.nivel]}`}>
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {avisoVolumen.titulo} · {movements.length.toLocaleString("es-PE")} movimientos
            </p>
            <p className="text-xs mt-0.5 opacity-90">{avisoVolumen.mensaje}</p>
          </div>
          <button
            onClick={cerrarAviso}
            aria-label="Cerrar aviso"
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Cabecera del reporte (solo impresión) */}
      <div className="print-only mb-2">
        <div className="flex items-center gap-3 border-b-2 border-stone-800 pb-3">
          <img src="/logo.png" alt="Las Flores" className="w-12 h-12 object-contain" />
          <div>
            <p className="font-serif text-lg font-bold text-stone-900">Reporte de Almacén — Restaurante Las Flores</p>
            <p className="text-xs text-stone-500">
              Generado el {now.toLocaleDateString("es-PE")} a las {now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>

      {/* Encabezado en pantalla */}
      <div className="no-print flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Panel Principal</h1>
          <p className="text-sm text-stone-400 mt-0.5">Resumen general del estado del almacén</p>
        </div>
        <button
          onClick={descargarPdf}
          title="Descargar reporte en PDF"
          className="btn-brand flex items-center gap-2 px-4 py-2 text-sm shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-4.414-4.414A1 1 0 0012.586 4H7a2 2 0 00-2 2v13a2 2 0 002 2z" />
          </svg>
          Descargar PDF
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KPICard label="Productos" value={totalProductos} sub="registrados" />
        <KPICard label="Unidades" value={totalUnidades.toLocaleString("es-PE")} sub="en stock" />
        <KPICard label="Valor inventario" value={`S/ ${soles(valorInventario)}`} sub="stock × costo" accent="text-stone-900" />
        <KPICard label="Entradas" value={entradas.length} sub={`S/ ${soles(valorEntradas)}`} accent="text-leaf-600" />
        <KPICard label="Salidas" value={salidas.length} sub={`S/ ${soles(valorSalidas)}`} accent="text-brand-600" />
        <KPICard
          label="Por reponer"
          value={porReponer.length + sinStock.length}
          sub={`${sinStock.length} sin stock`}
          accent={porReponer.length + sinStock.length > 0 ? "text-amber-600" : "text-stone-900"}
        />
      </div>
      <p className="no-print text-xs text-stone-400 -mt-3">
        Hoy: {todayMoves} movimiento{todayMoves !== 1 ? "s" : ""} ({today.split("-").reverse().join("/")})
      </p>

      {/* Inventario valorizado por categoría */}
      <SectionCard title="Inventario valorizado por categoría">
        {porCategoria.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-400 text-center">Sin productos registrados.</p>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={porCategoria} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} width={70} tickFormatter={(v) => `S/ ${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                  <Tooltip formatter={(v) => `S/ ${soles(Number(v) || 0)}`} />
                  <Bar dataKey="valor" name="Valor en stock" fill={BRAND} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-stone-400 uppercase tracking-wider border-b border-stone-100">
                    <th className="text-left py-2">Categoría</th>
                    <th className="text-right py-2">Productos</th>
                    <th className="text-right py-2">Unidades</th>
                    <th className="text-right py-2">Valor (S/)</th>
                    <th className="text-right py-2">% del total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {porCategoria.map((r) => (
                    <tr key={r.name}>
                      <td className="py-2 text-stone-700">{r.name}</td>
                      <td className="py-2 text-right font-mono text-stone-600">{r.productos}</td>
                      <td className="py-2 text-right font-mono text-stone-600">{r.unidades.toLocaleString("es-PE")}</td>
                      <td className="py-2 text-right font-mono text-stone-800">{soles(r.valor)}</td>
                      <td className="py-2 text-right font-mono text-stone-500">
                        {valorInventario > 0 ? ((r.valor / valorInventario) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2 text-stone-800">Total</td>
                    <td className="py-2 text-right font-mono text-stone-800">{totalProductos}</td>
                    <td className="py-2 text-right font-mono text-stone-800">{totalUnidades.toLocaleString("es-PE")}</td>
                    <td className="py-2 text-right font-mono text-stone-900">{soles(valorInventario)}</td>
                    <td className="py-2 text-right font-mono text-stone-500">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Movimientos por mes */}
      <SectionCard title="Movimientos — últimos 6 meses">
        <div className="p-5 flex flex-col gap-4">
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={porMes} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} />
                <YAxis tick={{ fontSize: 11, fill: "#78716c" }} width={30} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entradas" fill={LEAF} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Salidas" fill={BRAND} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-400 uppercase tracking-wider border-b border-stone-100">
                  <th className="text-left py-2">Mes</th>
                  <th className="text-right py-2">Entradas</th>
                  <th className="text-right py-2">S/ Entradas</th>
                  <th className="text-right py-2">Salidas</th>
                  <th className="text-right py-2">S/ Salidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {porMes.map((r) => (
                  <tr key={r.label}>
                    <td className="py-2 text-stone-700 capitalize">{r.label}</td>
                    <td className="py-2 text-right font-mono text-leaf-700">{r.Entradas}</td>
                    <td className="py-2 text-right font-mono text-stone-600">{soles(r.valorEnt)}</td>
                    <td className="py-2 text-right font-mono text-brand-600">{r.Salidas}</td>
                    <td className="py-2 text-right font-mono text-stone-600">{soles(r.valorSal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* Inventario por área */}
      <SectionCard title="Inventario por área">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Área</th>
                <th className="text-right px-5 py-2.5">Productos</th>
                <th className="text-right px-5 py-2.5">Unidades</th>
                <th className="text-right px-5 py-2.5">Valor (S/)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {porArea.map((r) => (
                <tr key={r.name}>
                  <td className="px-5 py-2 text-stone-700">{r.name}</td>
                  <td className="px-5 py-2 text-right font-mono text-stone-600">{r.productos}</td>
                  <td className="px-5 py-2 text-right font-mono text-stone-600">{r.unidades.toLocaleString("es-PE")}</td>
                  <td className="px-5 py-2 text-right font-mono text-stone-800">{soles(r.valor)}</td>
                </tr>
              ))}
              {porArea.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-stone-400 text-sm">Sin datos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Top productos por valor */}
      <SectionCard title="Top 10 productos por valor en stock">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Código</th>
                <th className="text-left px-5 py-2.5">Producto</th>
                <th className="text-right px-5 py-2.5">Disponible</th>
                <th className="text-right px-5 py-2.5">Costo unit.</th>
                <th className="text-right px-5 py-2.5">Valor en stock (S/)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {topProductos.map((i) => (
                <tr key={i.codigo}>
                  <td className="px-5 py-2 font-mono text-xs text-brand-700">{i.codigo}</td>
                  <td className="px-5 py-2 text-stone-700">{i.descripcion}</td>
                  <td className="px-5 py-2 text-right font-mono text-stone-600">
                    {i.cantidadDisponible} {i.unidadMedida || ""}
                  </td>
                  <td className="px-5 py-2 text-right font-mono text-stone-600">{soles(i.costo)}</td>
                  <td className="px-5 py-2 text-right font-mono text-stone-800">{soles(i.valorStock)}</td>
                </tr>
              ))}
              {topProductos.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-stone-400 text-sm">Sin productos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Por reponer */}
      <SectionCard title="Productos por reponer (bajo el mínimo)">
        {porReponer.length === 0 ? (
          <p className="px-5 py-4 text-sm text-stone-400">✅ Ningún producto por debajo de su stock mínimo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50/60 text-xs text-amber-700 uppercase tracking-wider">
                  <th className="text-left px-5 py-2.5">Código</th>
                  <th className="text-left px-5 py-2.5">Producto</th>
                  <th className="text-right px-5 py-2.5">Disponible</th>
                  <th className="text-right px-5 py-2.5">Mínimo</th>
                  <th className="text-left px-5 py-2.5">Área</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {porReponer.map((i) => (
                  <tr key={i.codigo}>
                    <td className="px-5 py-2 font-mono text-xs text-amber-800">{i.codigo}</td>
                    <td className="px-5 py-2 text-stone-700">{i.descripcion}</td>
                    <td className="px-5 py-2 text-right font-mono font-semibold text-amber-700">
                      {i.cantidadDisponible} {i.unidadMedida || ""}
                    </td>
                    <td className="px-5 py-2 text-right font-mono text-stone-500">{i.stockMinimo}</td>
                    <td className="px-5 py-2 text-stone-600">{i.area}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Sin stock */}
      <SectionCard title="Productos sin stock">
        {sinStock.length === 0 ? (
          <p className="px-5 py-4 text-sm text-stone-400">✅ Todos los productos tienen stock disponible.</p>
        ) : (
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {sinStock.map((i) => (
              <span key={i.codigo} className="text-xs bg-white border border-brand-200 text-brand-700 px-2 py-0.5 rounded font-mono">
                {i.codigo} — {i.descripcion}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      <p className="print-only text-[10px] text-stone-400 text-center pt-2 border-t border-stone-200">
        Sistema Almacén · Restaurante Las Flores — reporte generado automáticamente
      </p>
    </div>
  );
}
