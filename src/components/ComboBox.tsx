import { useEffect, useRef, useState } from "react";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** Convierte lo que se escribe a MAYÚSCULAS (para unidades de medida). */
  uppercase?: boolean;
}

/**
 * Campo tipo desplegable editable: se elige de la lista o se escribe un
 * valor nuevo. Lo que se escriba y se guarde en un movimiento vuelve a
 * aparecer en la lista la próxima vez (la lista la arma el store).
 */
export default function ComboBox({ id, value, onChange, options, placeholder, uppercase }: Props) {
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

  const q = value.trim().toLowerCase();
  // Sólo se filtra mientras se escribe; al abrir el desplegable se ve todo.
  const matches = typing && q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const list = matches.length > 0 ? matches : options;

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(uppercase ? e.target.value.toUpperCase() : e.target.value);
          setTyping(true);
          setOpen(true);
        }}
        onFocus={() => {
          setTyping(false);
          setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={`input pr-9 ${uppercase ? "uppercase" : ""}`}
      />
      <button
        type="button"
        onClick={() => {
          setTyping(false);
          setOpen((o) => !o);
        }}
        aria-label="Ver opciones"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
      >
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && list.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {list.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className={`w-full cursor-pointer px-3 py-1.5 text-left text-sm hover:bg-brand-50/70 ${
                o.toLowerCase() === q ? "font-semibold text-brand-700" : "text-stone-700"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
