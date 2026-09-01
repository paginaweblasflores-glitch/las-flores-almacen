import { useStore } from "../store";
import MovementsTable from "./MovementsTable";

export default function Exits() {
  const { movements } = useStore();
  const salidas = movements.filter((m) => m.tipo === "Salida").reverse();
  return (
    <MovementsTable
      movements={salidas}
      title="Salidas"
      subtitle={`${salidas.length} registros de retiro del almacén`}
      emptyMsg="No hay salidas registradas."
    />
  );
}
