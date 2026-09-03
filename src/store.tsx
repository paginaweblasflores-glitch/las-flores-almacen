import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Movement, InventoryItem } from "./types";
import { DEFAULT_CATEGORIES, UNIDADES_MEDIDA } from "./types";
import { supabase } from "./supabaseClient";
import { useToast } from "./toast";

const STORAGE_KEY = "SISTEMA_ALMACEN_MOVEMENTS_V1";
const CATEGORIES_STORAGE_KEY = "SISTEMA_ALMACEN_CATEGORIES_V1";

function unitCost(m: Movement): number {
  if (m.costo && m.costo > 0) return m.costo;
  return m.cantidad > 0 ? m.valor / m.cantidad : m.valor;
}

function buildInventory(movements: Movement[]): Map<string, InventoryItem> {
  const map = new Map<string, InventoryItem>();
  for (const m of movements) {
    const key = m.codigo.toUpperCase().trim();
    const existing = map.get(key);
    const costo = unitCost(m);
    const precioVenta = m.precioVenta && m.precioVenta > 0 ? m.precioVenta : costo;
    const categoria = m.categoria || DEFAULT_CATEGORIES[0];

    if (!existing) {
      map.set(key, {
        codigo: m.codigo,
        descripcion: m.descripcion,
        cantidadDisponible: m.tipo === "Entrada" ? m.cantidad : -m.cantidad,
        unidadMedida: m.unidadMedida,
        costo,
        precioVenta,
        stockMinimo: m.stockMinimo ?? 0,
        valor: costo,
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
      existing.costo = costo;
      existing.precioVenta = precioVenta;
      existing.valor = costo;
      existing.area = m.area;
      existing.descripcion = m.descripcion;
      if (m.stockMinimo != null && m.stockMinimo > 0) {
        existing.stockMinimo = m.stockMinimo;
      }
      if (m.unidadMedida) {
        existing.unidadMedida = m.unidadMedida;
      }
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

function movementFromRow(row: Record<string, unknown>): Movement {
  const cantidad = Number(row.cantidad);
  const valor = Number(row.valor);
  const costo = row.costo != null ? Number(row.costo) : cantidad > 0 ? valor / cantidad : 0;
  return {
    id: String(row.id),
    codigo: String(row.codigo),
    descripcion: String(row.descripcion),
    cantidad,
    unidadMedida: row.unidad_medida ? String(row.unidad_medida) : undefined,
    costo,
    precioVenta: row.precio_venta != null ? Number(row.precio_venta) : costo,
    stockMinimo: row.stock_minimo != null ? Number(row.stock_minimo) : 0,
    valor,
    fecha: String(row.fecha),
    responsable: String(row.responsable),
    area: String(row.area),
    categoria: row.categoria ? String(row.categoria) : undefined,
    tipo: row.tipo as Movement["tipo"],
    imagen: row.imagen ? String(row.imagen) : undefined,
    motivo: row.motivo ? String(row.motivo) : undefined,
  };
}

function movementToRow(movement: Movement) {
  return {
    id: movement.id,
    codigo: movement.codigo,
    descripcion: movement.descripcion,
    cantidad: movement.cantidad,
    unidad_medida: movement.unidadMedida ?? null,
    costo: movement.costo ?? 0,
    precio_venta: movement.precioVenta ?? 0,
    stock_minimo: movement.stockMinimo ?? 0,
    valor: movement.valor,
    fecha: movement.fecha,
    responsable: movement.responsable,
    area: movement.area,
    categoria: movement.categoria ?? null,
    tipo: movement.tipo,
    imagen: movement.imagen ?? null,
    motivo: movement.motivo ?? null,
  };
}

interface ProductPatch {
  codigo: string;
  descripcion: string;
  area: string;
  categoria?: string;
  unidadMedida?: string;
  costo?: number;
  precioVenta?: number;
  stockMinimo?: number;
  imagen?: string;
}

// Al registrar/editar un movimiento, costo, precioVenta y stockMinimo son
// opcionales: si no llegan, el store los deriva o usa 0.
export type MovementInput = Omit<Movement, "id" | "costo" | "precioVenta" | "stockMinimo" | "valor"> & {
  costo?: number;
  precioVenta?: number;
  stockMinimo?: number;
  valor?: number;
};

interface StoreCtx {
  movements: Movement[];
  inventory: InventoryItem[];
  categories: string[];
  unidades: string[];
  nextCodigo: () => string;
  addCategory: (category: string) => { success: boolean; message?: string };
  addMovement: (m: MovementInput) => string | null;
  updateMovement: (id: string, updated: MovementInput) => string | null;
  updateProduct: (oldCodigo: string, updated: ProductPatch) => void;
  deleteMovement: (id: string) => void;
  deleteProduct: (codigo: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

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
    // Con Supabase configurado, la base es la fuente de verdad: se
    // arranca vacío y se carga desde el servidor. localStorage solo
    // sirve de respaldo offline cuando no hay Supabase.
    if (supabase) return [];
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

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function loadFromSupabase() {
      const [movementResult, categoryResult] = await Promise.all([
        client!.from("movements").select("*").order("fecha", { ascending: true }),
        client!.from("categories").select("name").order("name"),
      ]);

      if (movementResult.error) {
        console.error("Error cargando movimientos desde Supabase:", movementResult.error);
        toast.error("No se pudieron cargar los movimientos. Revisa tu conexión.");
      } else {
        setMovements((movementResult.data ?? []).map(movementFromRow));
      }

      if (categoryResult.error) {
        console.error("Error cargando categorías desde Supabase:", categoryResult.error);
        toast.error("No se pudieron cargar las categorías.");
      } else if (categoryResult.data?.length) {
        setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...categoryResult.data.map((row) => row.name)])));
      }
    }

    void loadFromSupabase();
  }, [toast]);

  const inventory: InventoryItem[] = Array.from(buildInventory(movements).values());

  // Unidades de medida: las de por defecto + las que Rio ya haya escrito.
  const unidades = Array.from(
    new Set([
      ...UNIDADES_MEDIDA,
      ...movements
        .map((m) => (m.unidadMedida || "").trim().toUpperCase())
        .filter((u) => u !== ""),
    ])
  );

  // Siguiente código correlativo: máximo código numérico + 1.
  function nextCodigo(): string {
    let max = 0;
    for (const m of movements) {
      const n = parseInt(m.codigo.trim(), 10);
      if (!Number.isNaN(n) && String(n) === m.codigo.trim() && n > max) {
        max = n;
      }
    }
    return String(max + 1);
  }

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
    if (supabase) {
      void supabase.from("categories").insert({ name: trimmed }).then(({ error }) => {
        if (error) {
          console.error("Error guardando categoría en Supabase:", error);
          toast.error(`No se pudo guardar la categoría "${trimmed}" en el servidor.`);
        }
      });
    }
    return { success: true };
  }

  function addMovement(m: MovementInput): string | null {
    if (m.tipo === "Salida") {
      const item = buildInventory(movements).get(m.codigo.toUpperCase().trim());
      if (!item || item.cantidadDisponible < m.cantidad) {
        return `Stock insuficiente. Disponible: ${item?.cantidadDisponible ?? 0} unidades.`;
      }
    }
    const costo = m.costo ?? (m.valor && m.cantidad > 0 ? m.valor / m.cantidad : 0);
    const newM: Movement = {
      ...m,
      costo,
      precioVenta: m.precioVenta ?? costo,
      stockMinimo: m.stockMinimo ?? 0,
      valor: m.valor ?? costo * m.cantidad,
      categoria: m.categoria || categories[0] || DEFAULT_CATEGORIES[0],
      id: crypto.randomUUID(),
    };
    setMovements((prev) => [...prev, newM]);
    if (supabase) {
      void supabase.from("movements").insert(movementToRow(newM)).then(({ error }) => {
        if (error) {
          console.error("Error guardando movimiento en Supabase:", error);
          toast.error("El movimiento no se guardó en el servidor. Vuelve a intentarlo.");
        } else {
          toast.success(`${newM.tipo} de "${newM.descripcion}" guardada.`);
        }
      });
    }
    return null;
  }

  function updateMovement(id: string, updated: MovementInput): string | null {
    // Check stock if updated is a Salida or changes quantities
    const otherMovements = movements.filter((m) => m.id !== id);
    const simulatedInventory = buildInventory(otherMovements);

    if (updated.tipo === "Salida") {
      const available = simulatedInventory.get(updated.codigo.toUpperCase().trim())?.cantidadDisponible ?? 0;
      if (available < updated.cantidad) {
        return `Stock insuficiente para esta modificación. Disponible: ${available} unidades.`;
      }
    }

    const costo = updated.costo ?? (updated.valor && updated.cantidad > 0 ? updated.valor / updated.cantidad : 0);
    const merged: Movement = {
      ...updated,
      costo,
      precioVenta: updated.precioVenta ?? costo,
      stockMinimo: updated.stockMinimo ?? 0,
      valor: updated.valor ?? costo * updated.cantidad,
      categoria: updated.categoria || categories[0] || DEFAULT_CATEGORIES[0],
      id,
    };

    setMovements((prev) => prev.map((m) => (m.id === id ? merged : m)));
    if (supabase) {
      void supabase.from("movements").upsert(movementToRow(merged)).then(({ error }) => {
        if (error) {
          console.error("Error actualizando movimiento en Supabase:", error);
          toast.error("El cambio no se guardó en el servidor. Vuelve a intentarlo.");
        }
      });
    }
    return null;
  }

  function updateProduct(oldCodigo: string, updated: ProductPatch) {
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
              unidadMedida: updated.unidadMedida !== undefined ? updated.unidadMedida : m.unidadMedida,
              costo: updated.costo !== undefined ? updated.costo : m.costo,
              precioVenta: updated.precioVenta !== undefined ? updated.precioVenta : m.precioVenta,
              stockMinimo: updated.stockMinimo !== undefined ? updated.stockMinimo : m.stockMinimo,
              imagen: updated.imagen !== undefined ? updated.imagen : m.imagen,
            }
          : m
      )
    );
    if (supabase) {
      const patch: Record<string, unknown> = {
        codigo: updated.codigo.toUpperCase().trim(),
        descripcion: updated.descripcion.trim(),
        area: updated.area,
        categoria: updated.categoria ?? null,
        imagen: updated.imagen ?? null,
      };
      if (updated.unidadMedida !== undefined) patch.unidad_medida = updated.unidadMedida || null;
      if (updated.costo !== undefined) patch.costo = updated.costo;
      if (updated.precioVenta !== undefined) patch.precio_venta = updated.precioVenta;
      if (updated.stockMinimo !== undefined) patch.stock_minimo = updated.stockMinimo;
      void supabase.from("movements").update(patch).ilike("codigo", oldCodigo.trim()).then(({ error }) => {
        if (error) {
          console.error("Error actualizando producto en Supabase:", error);
          toast.error("El producto no se actualizó en el servidor. Vuelve a intentarlo.");
        }
      });
    }
  }

  function deleteMovement(id: string) {
    setMovements((prev) => prev.filter((m) => m.id !== id));
    if (supabase) {
      void supabase.from("movements").delete().eq("id", id).then(({ error }) => {
        if (error) {
          console.error("Error eliminando movimiento en Supabase:", error);
          toast.error("El movimiento no se eliminó en el servidor.");
        }
      });
    }
  }

  function deleteProduct(codigo: string) {
    const upper = codigo.toUpperCase().trim();
    setMovements((prev) => prev.filter((m) => m.codigo.toUpperCase().trim() !== upper));
    if (supabase) {
      void supabase.from("movements").delete().ilike("codigo", upper).then(({ error }) => {
        if (error) {
          console.error("Error eliminando producto en Supabase:", error);
          toast.error("El producto no se eliminó en el servidor.");
        }
      });
    }
  }

  function clearAll() {
    setMovements([]);
    if (supabase) {
      void supabase.from("movements").delete().neq("id", "").then(({ error }) => {
        if (error) {
          console.error("Error limpiando movimientos en Supabase:", error);
          toast.error("No se pudo vaciar el almacén en el servidor.");
        } else {
          toast.success("Almacén vaciado.");
        }
      });
    }
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
        unidades,
        nextCodigo,
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

