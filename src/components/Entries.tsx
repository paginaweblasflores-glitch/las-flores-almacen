import { useStore } from "../store";
import MovementsTable from "./MovementsTable";

export default function Entries() {
  const { movements } = useStore();
  const entradas = movements.filter((m) => m.tipo === "Entrada").reverse();
  return (
    <MovementsTable
      movements={entradas}
      title="Entradas"
      subtitle={`${entradas.length} registros de ingreso al almacén`}
      emptyMsg="No hay entradas registradas."
    />
  );
}
