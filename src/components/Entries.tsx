import { useStore } from "../store";
import MovementCart from "./MovementCart";
import MovementsTable from "./MovementsTable";

export default function Entries() {
  const { movements } = useStore();
  const entradas = movements.filter((m) => m.tipo === "Entrada").reverse();
  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-stone-900">Entradas</h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Registra el ingreso de productos ya existentes y consulta el historial.
        </p>
      </div>

      <MovementCart tipo="Entrada" />

      <MovementsTable
        movements={entradas}
        tipo="Entrada"
        title="Historial de entradas"
        subtitle={`${entradas.length} registros de ingreso al almacén`}
        emptyMsg="No hay entradas registradas."
      />
    </div>
  );
}
