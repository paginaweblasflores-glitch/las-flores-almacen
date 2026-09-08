import { useStore } from "../store";
import MovementCart from "./MovementCart";
import MovementsTable from "./MovementsTable";

export default function Exits() {
  const { movements } = useStore();
  const salidas = movements.filter((m) => m.tipo === "Salida").reverse();
  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-stone-900">Salidas</h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Registra el retiro de productos, imprime el comprobante para firmar y consulta el historial.
        </p>
      </div>

      <MovementCart tipo="Salida" />

      <MovementsTable
        movements={salidas}
        title="Historial de salidas"
        subtitle={`${salidas.length} registros de retiro del almacén`}
        emptyMsg="No hay salidas registradas."
      />
    </div>
  );
}
