import { useId } from "react";
import { useStore } from "../store";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Campo de unidad de medida: se elige de la lista o se escribe una nueva.
 * Las unidades que Rio escriba quedan disponibles la próxima vez.
 */
export default function UnidadInput({ id, value, onChange, className = "input uppercase" }: Props) {
  const { unidades } = useStore();
  const listId = useId();

  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="UNID"
        autoComplete="off"
        className={className}
      />
      <datalist id={listId}>
        {unidades.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </>
  );
}
