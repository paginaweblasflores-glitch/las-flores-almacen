import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Movement, InventoryItem } from "./types";
import { DEFAULT_CATEGORIES } from "./types";

const STORAGE_KEY = "SISTEMA_ALMACEN_MOVEMENTS_V1";
const CATEGORIES_STORAGE_KEY = "SISTEMA_ALMACEN_CATEGORIES_V1";

function buildInventory(movements: Movement[]): Map<string, InventoryItem> {
  const map = new Map<string, InventoryItem>();
  for (const m of movements) {
    const key = m.codigo.toUpperCase().trim();
    const existing = map.get(key);
    const unitValue = m.cantidad > 0 ? m.valor / m.cantidad : m.valor;
    const categoria = m.categoria || DEFAULT_CATEGORIES[0];

    if (!existing) {
      map.set(key, {
        codigo: m.codigo,
        descripcion: m.descripcion,
        cantidadDisponible: m.tipo === "Entrada" ? m.cantidad : -m.cantidad,
        valor: unitValue,
        fechaActualizacion: m.fecha,
        responsable: m.responsable,
        area: m.area,
        categoria,
        imagen: m.imagen,
      });
    } else {
      existing.cantidadDisponible += m.tipo === "Entrada" ? m.cantidad : -m.cantidad;
      existing.fechaActualizacion = m.fecha;
      existing.responsable = m.responsable;
      existing.valor = unitValue;
      existing.area = m.area;
      existing.descripcion = m.descripcion;
      if (m.categoria) {
        existing.categoria = m.categoria;
      }
      if (m.imagen) {
        existing.imagen = m.imagen;
      }
    }
  }
  return map;
}

interface StoreCtx {
  movements: Movement[];
  inventory: InventoryItem[];
  categories: string[];
  addCategory: (category: string) => { success: boolean; message?: string };
  addMovement: (m: Omit<Movement, "id">) => string | null;
  updateMovement: (id: string, updated: Omit<Movement, "id">) => string | null;
  updateProduct: (oldCodigo: string, updated: { codigo: string; descripcion: string; area: string; categoria?: string; imagen?: string }) => void;
  deleteMovement: (id: string) => void;
  deleteProduct: (codigo: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with DEFAULT_CATEGORIES to ensure all defaults are always present
          const unique = Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]));
          return unique;
        }
      }
    } catch (e) {
      console.error("Error reading categories from localStorage:", e);
    }
    return [...DEFAULT_CATEGORIES];
  });

  const [movements, setMovements] = useState<Movement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error reading movements from localStorage:", e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (e) {
      console.error("Error saving categories to localStorage:", e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
    } catch (e) {
      console.error("Error saving movements to localStorage:", e);
    }
  }, [movements]);

  const inventory: InventoryItem[] = Array.from(buildInventory(movements).values());

  function addCategory(categoryName: string): { success: boolean; message?: string } {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      return { success: false, message: "El nombre de la categoría no puede estar vacío." };
    }
    const exists = categories.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: "Esta categoría ya existe." };
    }
    setCategories((prev) => [...prev, trimmed]);
    return { success: true };
  }

  function addMovement(m: Omit<Movement, "id">): string | null {
    if (m.tipo === "Salida") {
      const item = buildInventory(movements).get(m.codigo.toUpperCase().trim());
      if (!item || item.cantidadDisponible < m.cantidad) {
        return `Stock insuficiente. Disponible: ${item?.cantidadDisponible ?? 0} unidades.`;
      }
    }
    const newM: Movement = {
      ...m,
      categoria: m.categoria || categories[0] || DEFAULT_CATEGORIES[0],
      id: Date.now().toString(),
    };
    setMovements((prev) => [...prev, newM]);
    return null;
  }

  function updateMovement(id: string, updated: Omit<Movement, "id">): string | null {
    // Check stock if updated is a Salida or changes quantities
    const otherMovements = movements.filter((m) => m.id !== id);
    const simulatedInventory = buildInventory(otherMovements);
    
    if (updated.tipo === "Salida") {
      const available = simulatedInventory.get(updated.codigo.toUpperCase().trim())?.cantidadDisponible ?? 0;
      if (available < updated.cantidad) {
        return `Stock insuficiente para esta modificación. Disponible: ${available} unidades.`;
      }
    }

    setMovements((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...updated,
              categoria: updated.categoria || m.categoria || categories[0] || DEFAULT_CATEGORIES[0],
              id,
            }
          : m
      )
    );
    return null;
  }

  function updateProduct(oldCodigo: string, updated: { codigo: string; descripcion: string; area: string; categoria?: string; imagen?: string }) {
    const oldUpper = oldCodigo.toUpperCase().trim();
    setMovements((prev) =>
      prev.map((m) =>
        m.codigo.toUpperCase().trim() === oldUpper
          ? {
              ...m,
              codigo: updated.codigo.toUpperCase().trim(),
              descripcion: updated.descripcion.trim(),
              area: updated.area,
              categoria: updated.categoria || m.categoria || categories[0] || DEFAULT_CATEGORIES[0],
              imagen: updated.imagen !== undefined ? updated.imagen : m.imagen,
            }
          : m
      )
    );
  }

  function deleteMovement(id: string) {
    setMovements((prev) => prev.filter((m) => m.id !== id));
  }

  function deleteProduct(codigo: string) {
    const upper = codigo.toUpperCase().trim();
    setMovements((prev) => prev.filter((m) => m.codigo.toUpperCase().trim() !== upper));
  }

  function clearAll() {
    setMovements([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Error clearing localStorage:", e);
    }
  }

  return (
    <Ctx.Provider
      value={{
        movements,
        inventory,
        categories,
        addCategory,
        addMovement,
        updateMovement,
        updateProduct,
        deleteMovement,
        deleteProduct,
        clearAll,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}

