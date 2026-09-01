import { useState } from "react";
import { useStore } from "../store";
import type { MovementType } from "../types";
import MovementsTable from "./MovementsTable";

export default function DateSearch() {
  const { movements } = useStore();
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [tipo, setTipo] = useState<MovementType | "Todos">("Todos");
  const [searched, setSearched] = useState(false);

  const results = movements.filter((m) => {
    const inRange = m.fecha >= from && m.fecha <= to;
    const matchTipo = tipo === "Todos" || m.tipo === tipo;
    return inRange && matchTipo;
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Movimientos por Fecha</h1>
        <p className="text-sm text-slate-400 mt-0.5">Consulta los movimientos dentro de un período</p>
      </div>

      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fecha inicial</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setSearched(false); }} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fecha final</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setSearched(false); }} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo</label>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as MovementType | "Todos"); setSearched(false); }} className="input">
            <option>Todos</option>
            <option>Entrada</option>
            <option>Salida</option>
          </select>
        </div>
        <button type="submit" className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors h-[38px]">
          Consultar
        </button>
      </form>

      {searched && (
        <MovementsTable
          movements={results}
          title=""
          subtitle={`${results.length} movimientos del ${from.split("-").reverse().join("/")} al ${to.split("-").reverse().join("/")}`}
          emptyMsg="No se encontraron movimientos en el período seleccionado."
        />
      )}
    </div>
  );
}
