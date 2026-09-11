import { useEffect, useRef, useState } from "react";
import { uploadProductImage } from "../utils/storage";

interface Props {
  value: string;
  onChange: (url: string) => void;
  onError: (message: string) => void;
  label?: string;
  hint?: string; // ej. "(opcional)"
}

// Campo de imagen de producto reutilizable: subir con clic, arrastrar y
// soltar, o pegar (Ctrl+V) una captura / imagen copiada. Las tres formas
// terminan en el mismo `uploadProductImage`.
export default function ImageUploadField({ value, onChange, onError, label = "Imagen del producto", hint }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function procesarImagen(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Selecciona un archivo de imagen válido (JPG, PNG, WebP).");
      return;
    }
    try {
      setIsUploading(true);
      const url = await uploadProductImage(file);
      onChange(url);
    } catch (err) {
      console.error(err);
      onError("No se pudo procesar la imagen seleccionada.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    void procesarImagen(e.target.files?.[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (isUploading) return;
    void procesarImagen(e.dataTransfer.files?.[0]);
  }

  // Saca un archivo de imagen del portapapeles (captura de pantalla o
  // "Copiar imagen"). Devuelve true si había una imagen y la procesó.
  function imagenDelPortapapeles(cd: DataTransfer | null | undefined): boolean {
    if (!cd || isUploading) return false;
    if (cd.files && cd.files.length > 0 && cd.files[0].type.startsWith("image/")) {
      void procesarImagen(cd.files[0]);
      return true;
    }
    for (const item of Array.from(cd.items ?? [])) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        void procesarImagen(item.getAsFile() ?? undefined);
        return true;
      }
    }
    return false;
  }

  // Pegar (Ctrl+V) en cualquier parte de la página mientras este campo está
  // montado, salvo mientras se escribe en un campo de texto.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const el = document.activeElement;
      const escribiendo =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (escribiendo) return;
      if (imagenDelPortapapeles(e.clipboardData)) e.preventDefault();
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploading]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
          {label} {hint && <span className="text-stone-400 font-normal lowercase">{hint}</span>}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="text-[11px] text-brand-500 hover:text-brand-700 font-medium cursor-pointer"
          >
            Quitar foto
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {value ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex items-center gap-3 p-2 border rounded-lg transition-colors ${
            dragOver ? "border-brand-500 bg-brand-50/60" : "bg-stone-50 border-stone-200"
          }`}
        >
          <img
            src={value}
            alt="Vista previa del producto"
            className="w-12 h-12 rounded-md object-cover border border-stone-200 shadow-xs flex-shrink-0"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] text-brand-600 hover:text-brand-800 font-medium cursor-pointer"
          >
            Cambiar imagen
          </button>
          <span className="text-[11px] text-stone-400 ml-auto hidden sm:block">o arrastra / pega (Ctrl+V) otra</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          disabled={isUploading}
          className={`w-full py-3 px-3 border border-dashed rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            dragOver
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-stone-300 hover:border-brand-500 hover:bg-brand-50/50 text-stone-600 bg-stone-50/50"
          }`}
        >
          <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>
            {isUploading
              ? "Subiendo imagen..."
              : dragOver
              ? "Suelta la imagen para subirla"
              : "Elegir archivo, arrastrar o pegar (Ctrl+V)"}
          </span>
        </button>
      )}
    </div>
  );
}
