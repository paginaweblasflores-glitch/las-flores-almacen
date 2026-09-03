import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Campo de unidad de medida: se elige de la lista desplegable o se
 * escribe una nueva. Las unidades que se escriban quedan disponibles
 * la próxima vez.
 */
export default function UnidadInput({ id, value, onChange }: Props) {
  const { unidades } = useStore();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = value.trim().toUpperCase();
  // Sólo se filtra mientras se escribe; al abrir el desplegable se ve todo.
  const matches = typing && q ? unidades.filter((u) => u.includes(q)) : unidades;
  const list = matches.length > 0 ? matches : unidades;

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setTyping(true);
          setOpen(true);
        }}
        onFocus={() => {
          setTyping(false);
          setOpen(true);
        }}
        placeholder="UNID"
        autoComplete="off"
        className="input uppercase pr-9"
      />
      <button
        type="button"
        onClick={() => {
          setTyping(false);
          setOpen((o) => !o);
        }}
        aria-label="Ver unidades"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
      >
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && list.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
          {list.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                onChange(u);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm font-mono cursor-pointer hover:bg-brand-50/70 ${
                u === q ? "text-brand-700 font-semibold" : "text-stone-700"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
