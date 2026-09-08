import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Movement, InventoryItem } from "./types";
import { AREAS, DEFAULT_CATEGORIES, UNIDADES_MEDIDA } from "./types";
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
    const categoria = m.categoria || DEFAULT_CATEGORIES[0];

    if (!existing) {
      map.set(key, {
        codigo: m.codigo,
        descripcion: m.descripcion,
        cantidadDisponible: m.tipo === "Entrada" ? m.cantidad : -m.cantidad,
        unidadMedida: m.unidadMedida,
        costo,
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

export interface CierrePreview {
  corte: string;        // "AAAA-12-31" — se archivan los movimientos con fecha <= corte
  inicioNuevo: string;  // "AAAA+1-01-01" — fecha de los saldos iniciales
  marca: string;        // responsable de los saldos: "SALDO INICIAL AAAA+1"
  archivados: Movement[];
  saldos: Movement[];   // un saldo inicial por producto (Entrada con el stock al corte)
  negativos: number;    // productos con stock negativo que quedarán en 0
}

export interface CierreResult {
  error: string | null;
  archivados: number;
  saldosCreados: number;
  borrados: number;
}

// Arma el cierre anual: qué movimientos se archivan (fecha <= 31/12 del año) y
// el saldo inicial de cada producto (una Entrada fechada el 01/01 del año
// siguiente con el stock a esa fecha). El costo se copia del inventario, sin
// cálculos. Los productos en 0 —o en negativo, que pasan a 0— también reciben saldo.
export function construirCierre(movements: Movement[], anio: number): CierrePreview {
  const corte = `${anio}-12-31`;
  const inicioNuevo = `${anio + 1}-01-01`;
  const marca = `SALDO INICIAL ${anio + 1}`;
  const archivados = movements.filter((m) => m.fecha <= corte);
  const inv = Array.from(buildInventory(archivados).values());
  let negativos = 0;
  const saldos: Movement[] = inv.map((item) => {
    if (item.cantidadDisponible < 0) negativos++;
    const cantidad = Math.max(0, item.cantidadDisponible);
    return {
      id: crypto.randomUUID(),
      codigo: item.codigo,
      descripcion: item.descripcion,
      cantidad,
      unidadMedida: item.unidadMedida,
      costo: item.costo,
      stockMinimo: item.stockMinimo,
      valor: Math.round(item.costo * cantidad * 100) / 100,
      fecha: inicioNuevo,
      responsable: marca,
      area: item.area,
      categoria: item.categoria,
      tipo: "Entrada",
      imagen: item.imagen,
      motivo: `Cierre de ${anio}`,
    };
  });
  return { corte, inicioNuevo, marca, archivados, saldos, negativos };
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
    stockMinimo: row.stock_minimo != null ? Number(row.stock_minimo) : 0,
    valor,
    fecha: String(row.fecha),
    responsable: String(row.responsable).toUpperCase(),
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
  stockMinimo?: number;
  imagen?: string;
}

// Al registrar/editar un movimiento, costo y stockMinimo son opcionales:
// si no llegan, el store los deriva o usa 0.
export type MovementInput = Omit<Movement, "id" | "costo" | "stockMinimo" | "valor"> & {
  costo?: number;
  stockMinimo?: number;
  valor?: number;
};

interface StoreCtx {
  movements: Movement[];
  inventory: InventoryItem[];
  categories: string[];
  unidades: string[];
  areas: string[];
  nextCodigo: () => string;
  addMovement: (m: MovementInput) => string | null;
  addMovements: (list: MovementInput[]) => string | null;
  updateMovement: (id: string, updated: MovementInput) => string | null;
  updateProduct: (oldCodigo: string, updated: ProductPatch) => void;
  deleteMovement: (id: string) => void;
  deleteProduct: (codigo: string) => void;
  clearAll: () => void;
  cerrarAnio: (anio: number) => Promise<CierreResult>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  // Categorías guardadas (semilla + las que se crearon en versiones previas).
  const [dbCategories, setDbCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]));
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
        return (JSON.parse(saved) as Movement[]).map((m) => ({
          ...m,
          responsable: (m.responsable ?? "").toUpperCase(),
        }));
      }
    } catch (e) {
      console.error("Error reading movements from localStorage:", e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(dbCategories));
    } catch (e) {
      console.error("Error saving categories to localStorage:", e);
    }
  }, [dbCategories]);

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

    // Supabase (PostgREST) devuelve como máximo 1000 filas por consulta.
    // Se pagina con .range() hasta traer todos los movimientos reales.
    async function fetchAllMovements() {
      const PAGE = 1000;
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client!
          .from("movements")
          .select("*")
          .order("fecha", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return { data: rows, error: null as null };
    }

    async function loadFromSupabase() {
      const [movementResult, categoryResult] = await Promise.all([
        fetchAllMovements(),
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
        setDbCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...categoryResult.data.map((row) => row.name)])));
      }
    }

    void loadFromSupabase();
  }, [toast]);

  const inventory: InventoryItem[] = Array.from(buildInventory(movements).values());

  // Listas para los desplegables editables: valores por defecto + los que
  // ya se hayan usado en algún movimiento. Al escribir uno nuevo y guardar,
  // vuelve a aparecer aquí sin necesidad de una tabla aparte.
  function usados(pick: (m: Movement) => string | undefined, up = false) {
    return movements
      .map((m) => {
        const v = (pick(m) || "").trim();
        return up ? v.toUpperCase() : v;
      })
      .filter((v) => v !== "");
  }

  const unidades = Array.from(new Set([...UNIDADES_MEDIDA, ...usados((m) => m.unidadMedida, true)]));
  const areas = Array.from(new Set([...AREAS, ...usados((m) => m.area)]));
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...dbCategories, ...usados((m) => m.categoria)]));

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
      stockMinimo: m.stockMinimo ?? 0,
      valor: m.valor ?? costo * m.cantidad,
      responsable: m.responsable.toUpperCase().trim(),
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

  // Registra varios movimientos a la vez (carrito de entrada/salida).
  function addMovements(list: MovementInput[]): string | null {
    if (list.length === 0) return "El carrito está vacío.";

    // Chequeo de stock acumulado: dos líneas del mismo código se descuentan juntas.
    const inv = buildInventory(movements);
    const running = new Map<string, number>();
    for (const m of list) {
      if (m.tipo !== "Salida") continue;
      const key = m.codigo.toUpperCase().trim();
      const disponible = running.has(key)
        ? (running.get(key) as number)
        : inv.get(key)?.cantidadDisponible ?? 0;
      const restante = disponible - m.cantidad;
      if (restante < 0) {
        return `Stock insuficiente para "${m.descripcion}". Disponible: ${Math.max(0, disponible)}.`;
      }
      running.set(key, restante);
    }

    const newMs: Movement[] = list.map((m) => {
      const costo = m.costo ?? (m.valor && m.cantidad > 0 ? m.valor / m.cantidad : 0);
      return {
        ...m,
        costo,
        stockMinimo: m.stockMinimo ?? 0,
        valor: m.valor ?? costo * m.cantidad,
        responsable: m.responsable.toUpperCase().trim(),
        categoria: m.categoria || categories[0] || DEFAULT_CATEGORIES[0],
        id: crypto.randomUUID(),
      };
    });
    const newIds = new Set(newMs.map((m) => m.id));

    setMovements((prev) => [...prev, ...newMs]);

    if (supabase) {
      const tipo = list[0].tipo;
      void supabase
        .from("movements")
        .insert(newMs.map(movementToRow))
        .then(({ error }) => {
          if (error) {
            console.error("Error guardando movimientos en Supabase:", error);
            setMovements((prev) => prev.filter((m) => !newIds.has(m.id)));
            toast.error(
              `No se guardaron los ${newMs.length} movimientos. Vuelve a intentarlo.`
            );
          } else {
            toast.success(`${newMs.length} movimiento(s) de ${tipo} guardados.`);
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
      stockMinimo: updated.stockMinimo ?? 0,
      valor: updated.valor ?? costo * updated.cantidad,
      responsable: updated.responsable.toUpperCase().trim(),
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

  // Cierre anual: archiva los movimientos con fecha <= 31/12 del año elegido y
  // los reemplaza por un saldo inicial por producto (Entrada fechada el 01/01
  // del año siguiente). Lo hace la app: primero crea los saldos, verifica, y
  // recién entonces borra los archivados en lotes. Si el borrado se corta a la
  // mitad, un nuevo intento NO vuelve a crear saldos (ya existen): solo repite
  // el borrado de lo que quedó, así no hay doble conteo.
  async function cerrarAnio(anio: number): Promise<CierreResult> {
    const { marca, archivados, saldos } = construirCierre(movements, anio);
    if (archivados.length === 0) {
      return {
        error: `No hay movimientos con fecha del ${anio} o de años anteriores.`,
        archivados: 0,
        saldosCreados: 0,
        borrados: 0,
      };
    }

    const saldosYaExisten = movements.some((m) => m.responsable === marca);

    // 1) Crear los saldos iniciales (se omite si ya se crearon en un intento previo).
    if (!saldosYaExisten) {
      if (supabase) {
        const { data, error } = await supabase
          .from("movements")
          .insert(saldos.map(movementToRow))
          .select("id");
        if (error || !data || data.length !== saldos.length) {
          console.error("Cierre anual: error creando saldos iniciales", error);
          if (data && data.length) {
            await supabase.from("movements").delete().in("id", data.map((r) => String(r.id)));
          }
          return {
            error:
              "No se pudieron crear los saldos iniciales. No se borró ningún movimiento; volvé a intentarlo.",
            archivados: archivados.length,
            saldosCreados: 0,
            borrados: 0,
          };
        }
      }
      setMovements((prev) => [...prev, ...saldos]);
    }

    // 2) Borrar los movimientos archivados, en lotes.
    const ids = archivados.map((m) => m.id);
    let borrados = 0;
    if (supabase) {
      for (let i = 0; i < ids.length; i += 150) {
        const chunk = ids.slice(i, i + 150);
        const { error } = await supabase.from("movements").delete().in("id", chunk);
        if (error) {
          console.error("Cierre anual: error borrando lote de archivados", error);
          if (borrados > 0) {
            const hechos = new Set(ids.slice(0, borrados));
            setMovements((prev) => prev.filter((m) => !hechos.has(m.id)));
          }
          return {
            error: `Se crearon los saldos iniciales, pero faltó borrar ${
              ids.length - borrados
            } movimientos antiguos. Volvé a hacer el cierre del ${anio}: solo se repetirá el borrado.`,
            archivados: archivados.length,
            saldosCreados: saldosYaExisten ? 0 : saldos.length,
            borrados,
          };
        }
        borrados += chunk.length;
      }
    }

    // 3) Éxito: reflejar en el estado local.
    const idSet = new Set(ids);
    setMovements((prev) => prev.filter((m) => !idSet.has(m.id)));
    return {
      error: null,
      archivados: archivados.length,
      saldosCreados: saldosYaExisten ? 0 : saldos.length,
      borrados: ids.length,
    };
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
        areas,
        nextCodigo,
        addMovement,
        addMovements,
        updateMovement,
        updateProduct,
        deleteMovement,
        deleteProduct,
        clearAll,
        cerrarAnio,
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

