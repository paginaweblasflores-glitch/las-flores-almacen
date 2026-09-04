import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { Movement } from "../types";
import EditMovementModal from "./EditMovementModal";
import Pager from "./Pager";

const PAGE_SIZE = 25;

interface Props {
  movements: Movement[];
  title: string;
  subtitle?: string;
  emptyMsg?: string;
}

export default function MovementsTable({ movements, title, subtitle, emptyMsg = "No hay movimientos." }: Props) {
  const { deleteMovement } = useStore();
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [movements.length]);

  const pageItems = movements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleDelete(id: string) {
    deleteMovement(id);
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {title && (
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
          {subtitle && <p className="text-sm text-stone-400 mt-0.5">{subtitle}</p>}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-50 text-xs text-stone-400 uppercase tracking-wider [&>th]:bg-stone-50 [&>th]:border-b [&>th]:border-stone-200">
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Cantidad</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Responsable</th>
                <th className="text-left px-4 py-3">Área</th>
                <th className="text-center px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {pageItems.map((m) => (
                <tr key={m.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-brand-700">{m.codigo}</td>
                  <td className="px-4 py-3 text-stone-800 font-medium">
                    <div className="flex items-center gap-2.5">
                      {m.imagen ? (
                        <img
                          src={m.imagen}
                          alt={m.descripcion}
                          className="w-8 h-8 rounded-md object-cover border border-stone-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-stone-100 text-stone-400 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <span>{m.descripcion}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                      {m.categoria || "Sin categoría"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${m.tipo === "Entrada" ? "bg-leaf-50 text-leaf-700" : "bg-brand-50 text-brand-600"}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-stone-700">{m.cantidad}</td>
                  <td className="px-4 py-3 text-right font-mono text-stone-600">S/ {m.valor.toFixed(2)}</td>
                  <td className="px-4 py-3 text-stone-500">{m.fecha.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3 text-stone-600">{m.responsable}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{m.area}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {deletingId === m.id ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="px-2 py-0.5 bg-brand-600 text-white rounded text-[11px] font-semibold hover:bg-brand-700 cursor-pointer"
                          title="Confirmar eliminación"
                        >
                          Borrar
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-0.5 bg-stone-200 text-stone-700 rounded text-[11px] hover:bg-stone-300 cursor-pointer"
                          title="Cancelar"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingMovement(m)}
                          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Editar este movimiento"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingId(m.id)}
                          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Eliminar este movimiento"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-stone-400 text-sm">{emptyMsg}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={movements.length} onPage={setPage} />
      </div>

      {/* Edit Movement Modal */}
      <EditMovementModal
        movement={editingMovement}
        onClose={() => setEditingMovement(null)}
      />
    </div>
  );
}
