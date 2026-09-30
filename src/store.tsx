import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Movement, InventoryItem, MovementType, Comprobante, Traspaso, TraspasoEstado, TraspasoItem, TraspasoItemRecibido, Producto, ProductoMaestro } from "./types";
import { AREAS, DEFAULT_CATEGORIES, UNIDADES_MEDIDA } from "./types";
import { supabase, cuentaPorAlmacen } from "./supabaseClient";
import { useToast } from "./toast";

const STORAGE_KEY = "SISTEMA_ALMACEN_MOVEMENTS_V1";
const CATEGORIES_STORAGE_KEY = "SISTEMA_ALMACEN_CATEGORIES_V1";

function unitCost(m: Movement): number {
  if (m.costo && m.costo > 0) return m.costo;
  return m.cantidad > 0 ? m.valor / m.cantidad : m.valor;
}

// El inventario de un almacén es SOLO lo que tiene movimientos reales ahí
// — cada almacén es independiente (ver AGENTS.md). El catálogo maestro
// (`productos`, identidad compartida) y el código local de cada almacén
// (`producto_codigos`) siguen permitiendo que el traspaso funcione sin
// crear nada a mano, pero NO se mezclan acá: mezclarlo hacía que el
// inventario de un almacén mostrara productos que en realidad nunca tuvo,
// con cantidad 0 — confundía los conteos ("334 productos" en Umaru cuando
// tenía muchos menos). Ver `registrarProductoEnAlmacen`/`NewProductEntryForm`
// para cómo se resuelve un producto que ya existe en el catálogo maestro
// pero es nuevo para este almacén, sin duplicar la identidad.
export function buildInventory(movements: Movement[]): Map<string, InventoryItem> {
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

export function movementFromRow(row: Record<string, unknown>): Movement {
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
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

const PREFIJO = { Entrada: "E", Salida: "S" } as const;

export function etiquetaComprobante(c: Comprobante): string {
  return `${PREFIJO[c.tipo]}-${c.numero}`;
}

// id de movimiento -> "E-1" / "S-1", tomado de los comprobantes guardados.
export function calcularNumeros(comprobantes: Comprobante[]): Map<string, string> {
  const res = new Map<string, string>();
  for (const c of comprobantes) {
    const label = etiquetaComprobante(c);
    for (const mid of c.movementIds) res.set(mid, label);
  }
  return res;
}

function comprobanteFromRow(row: Record<string, unknown>): Comprobante {
  const rawItems = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [];
  return {
    id: String(row.id),
    tipo: row.tipo as MovementType,
    numero: Number(row.numero),
    periodo: String(row.periodo),
    fecha: String(row.fecha),
    area: String(row.area),
    responsable: String(row.responsable),
    observaciones: row.observaciones ? String(row.observaciones) : undefined,
    items: rawItems.map((it) => ({
      codigo: String(it.codigo ?? ""),
      descripcion: String(it.descripcion ?? ""),
      cantidad: Number(it.cantidad ?? 0),
      unidadMedida: String(it.unidad_medida ?? it.unidadMedida ?? "UNID"),
    })),
    movementIds: Array.isArray(row.movement_ids) ? (row.movement_ids as unknown[]).map(String) : [],
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

function comprobanteToRow(c: Comprobante, almacen: string) {
  return {
    id: c.id,
    tipo: c.tipo,
    numero: c.numero,
    periodo: c.periodo,
    fecha: c.fecha,
    area: c.area,
    responsable: c.responsable,
    observaciones: c.observaciones ?? null,
    items: c.items.map((it) => ({
      codigo: it.codigo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      unidad_medida: it.unidadMedida,
    })),
    movement_ids: c.movementIds,
    almacen,
  };
}

export function traspasoFromRow(row: Record<string, unknown>): Traspaso {
  const rawItems = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [];
  const rawItemsRecibidos = Array.isArray(row.items_recibidos)
    ? (row.items_recibidos as Record<string, unknown>[])
    : null;
  const rawItemsRechazados = Array.isArray(row.items_rechazados)
    ? (row.items_rechazados as Record<string, unknown>[])
    : null;
  return {
    id: String(row.id),
    numero: Number(row.numero),
    periodo: String(row.periodo),
    almacenOrigen: String(row.almacen_origen),
    almacenDestino: String(row.almacen_destino),
    estado: row.estado as TraspasoEstado,
    fechaEnvio: String(row.fecha_envio),
    responsableEnvio: String(row.responsable_envio),
    motivo: row.motivo ? String(row.motivo) : undefined,
    items: rawItems.map((it) => ({
      productoId: String(it.productoId ?? ""),
      codigo: String(it.codigo ?? ""),
      descripcion: String(it.descripcion ?? ""),
      cantidad: Number(it.cantidad ?? 0),
      unidadMedida: it.unidadMedida ? String(it.unidadMedida) : undefined,
      costo: Number(it.costo ?? 0),
      categoria: it.categoria ? String(it.categoria) : undefined,
    })),
    movementIdsSalida: Array.isArray(row.movement_ids_salida) ? (row.movement_ids_salida as unknown[]).map(String) : [],
    fechaRecepcion: row.fecha_recepcion ? String(row.fecha_recepcion) : undefined,
    responsableRecepcion: row.responsable_recepcion ? String(row.responsable_recepcion) : undefined,
    itemsRecibidos: rawItemsRecibidos
      ? rawItemsRecibidos.map((it) => ({
          productoId: String(it.productoId ?? ""),
          codigo: String(it.codigo ?? ""),
          descripcion: String(it.descripcion ?? ""),
          cantidad: Number(it.cantidad ?? 0),
          unidadMedida: it.unidadMedida ? String(it.unidadMedida) : undefined,
          costo: Number(it.costo ?? 0),
          categoria: it.categoria ? String(it.categoria) : undefined,
          area: String(it.area ?? ""),
        }))
      : undefined,
    itemsRechazados: rawItemsRechazados
      ? rawItemsRechazados.map((it) => ({
          productoId: String(it.productoId ?? ""),
          codigo: String(it.codigo ?? ""),
          descripcion: String(it.descripcion ?? ""),
          cantidad: Number(it.cantidad ?? 0),
          unidadMedida: it.unidadMedida ? String(it.unidadMedida) : undefined,
          costo: Number(it.costo ?? 0),
          categoria: it.categoria ? String(it.categoria) : undefined,
        }))
      : undefined,
    movementIdsEntrada: Array.isArray(row.movement_ids_entrada) ? (row.movement_ids_entrada as unknown[]).map(String) : [],
    motivoCancelacion: row.motivo_cancelacion ? String(row.motivo_cancelacion) : undefined,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

function traspasoToRow(t: Traspaso) {
  return {
    id: t.id,
    numero: t.numero,
    periodo: t.periodo,
    almacen_origen: t.almacenOrigen,
    almacen_destino: t.almacenDestino,
    estado: t.estado,
    fecha_envio: t.fechaEnvio,
    responsable_envio: t.responsableEnvio,
    motivo: t.motivo ?? null,
    items: t.items,
    movement_ids_salida: t.movementIdsSalida,
    fecha_recepcion: t.fechaRecepcion ?? null,
    responsable_recepcion: t.responsableRecepcion ?? null,
    items_recibidos: t.itemsRecibidos ?? null,
    items_rechazados: t.itemsRechazados ?? null,
    movement_ids_entrada: t.movementIdsEntrada,
    motivo_cancelacion: t.motivoCancelacion ?? null,
  };
}

export function etiquetaTraspaso(t: Traspaso): string {
  return `T-${t.numero}`;
}

function productoMaestroFromRow(row: Record<string, unknown>): ProductoMaestro {
  return {
    id: String(row.id ?? ""),
    descripcion: String(row.descripcion ?? ""),
    unidadMedida: row.unidad_medida ? String(row.unidad_medida) : undefined,
    categoria: row.categoria ? String(row.categoria) : undefined,
    imagen: row.imagen ? String(row.imagen) : undefined,
  };
}

function productoMaestroToRow(p: NuevoProductoMaestro, creadoEnAlmacen: string) {
  return {
    descripcion: p.descripcion,
    unidad_medida: p.unidadMedida ?? null,
    categoria: p.categoria ?? null,
    imagen: p.imagen ?? null,
    creado_en_almacen: creadoEnAlmacen,
  };
}

// Mi propia vista de un producto: la identidad compartida (productoMaestro)
// + el código que le di YO en mi almacén (producto_codigos). Ver Producto
// en types.ts — por qué `codigo` viaja junto al `id` acá.
function productoLocal(maestro: ProductoMaestro, codigo: string): Producto {
  return {
    id: maestro.id,
    codigo,
    descripcion: maestro.descripcion,
    unidadMedida: maestro.unidadMedida,
    categoria: maestro.categoria,
    imagen: maestro.imagen,
  };
}

function movementToRow(movement: Movement, almacen: string) {
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
    almacen,
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

interface NuevoProductoMaestro {
  descripcion: string;
  unidadMedida?: string;
  categoria?: string;
  imagen?: string;
}

// Da de alta un producto EN MI ALMACÉN, con el código que yo elegí (o el
// correlativo automático). Dos casos: `productoId` cuando es un producto
// que ya existe en el catálogo maestro (la persona confirmó la sugerencia
// — no se crea identidad nueva, solo mi código local); `nuevo` cuando es
// una identidad realmente nueva (se crea en el catálogo maestro primero).
export type RegistrarProductoInput =
  | { codigo: string; productoId: string }
  | { codigo: string; nuevo: NuevoProductoMaestro };

export interface RegistrarProductoResult {
  error: string | null;
  codigo: string | null;
}

// Al registrar/editar un movimiento, costo y stockMinimo son opcionales:
// si no llegan, el store los deriva o usa 0.
export type MovementInput = Omit<Movement, "id" | "costo" | "stockMinimo" | "valor"> & {
  costo?: number;
  stockMinimo?: number;
  valor?: number;
};

// Lo que arma el carrito de traspaso: destino + productos de MI inventario.
export interface EnviarTraspasoInput {
  almacenDestino: string;
  items: TraspasoItem[];
  fecha: string;
  responsable: string;
  motivo?: string;
}

// `numero` viene del traspaso recién creado (asignado por la base, ver
// migration-fase14.sql) — no hay que volver a calcularlo del lado del
// cliente para armar el comprobante impreso.
export interface EnviarTraspasoResult {
  error: string | null;
  numero: number | null;
}

// Una línea aceptada al recibir un traspaso: `productoId` es la identidad
// compartida (catálogo maestro), así que lo único que decide el destino es
// cuánto acepta y en qué área la guarda — el código LOCAL para esa línea
// lo resuelve `recibirTraspaso` (reusa el que ya tenga, o le asigna el
// siguiente de mi propia secuencia), no hay que "resolverla" a mano.
export interface ResueltoTraspasoItem {
  productoId: string;
  cantidad: number;
  area: string;
}

interface StoreCtx {
  almacen: string;
  movements: Movement[];
  inventory: InventoryItem[];
  comprobantes: Comprobante[];
  numeros: Map<string, string>;         // id de movimiento -> "E-1" / "S-1"
  proximoNumero: (tipo: MovementType) => string; // el que le tocará al próximo registro
  categories: string[];
  unidades: string[];
  areas: string[];
  productos: Producto[];                // MI vista: mis códigos locales + la identidad de cada uno
  catalogoMaestro: ProductoMaestro[];    // catálogo compartido completo (los dos almacenes), sin código
  nextCodigo: () => string;
  registrarProductoEnAlmacen: (input: RegistrarProductoInput) => Promise<RegistrarProductoResult>;
  addMovement: (m: MovementInput) => string | null;
  addMovements: (list: MovementInput[]) => string | null;
  updateMovement: (id: string, updated: MovementInput) => string | null;
  updateProduct: (oldCodigo: string, updated: ProductPatch) => void;
  deleteMovement: (id: string) => void;
  deleteProduct: (codigo: string) => void;
  cerrarAnio: (anio: number) => Promise<CierreResult>;
  traspasos: Traspaso[];
  enviarTraspaso: (input: EnviarTraspasoInput) => Promise<EnviarTraspasoResult>;
  recibirTraspaso: (
    traspasoId: string,
    resueltos: ResueltoTraspasoItem[],
    responsable: string,
    fecha: string,
  ) => Promise<string | null>;
  cancelarTraspaso: (traspasoId: string, motivo?: string) => Promise<string | null>;
}

const Ctx = createContext<StoreCtx | null>(null);

// Cada almacén (cuenta de acceso) tiene su propio respaldo local, así el
// caché offline de uno no se mezcla con el de otro en el mismo navegador.
function claveAlmacen(base: string, almacen: string): string {
  return `${base}::${almacen}`;
}

export function StoreProvider({ children, almacen }: { children: ReactNode; almacen: string }) {
  const toast = useToast();
  const storageKey = claveAlmacen(STORAGE_KEY, almacen);
  const categoriesStorageKey = claveAlmacen(CATEGORIES_STORAGE_KEY, almacen);

  // Categorías guardadas (semilla + las que se crearon en versiones previas).
  const [dbCategories, setDbCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(categoriesStorageKey);
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
      const saved = localStorage.getItem(storageKey);
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
      localStorage.setItem(categoriesStorageKey, JSON.stringify(dbCategories));
    } catch (e) {
      console.error("Error saving categories to localStorage:", e);
    }
  }, [categoriesStorageKey, dbCategories]);

  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [traspasos, setTraspasos] = useState<Traspaso[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [catalogoMaestro, setCatalogoMaestro] = useState<ProductoMaestro[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(movements));
    } catch (e) {
      console.error("Error saving movements to localStorage:", e);
    }
  }, [storageKey, movements]);

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
          .eq("almacen", almacen)
          .order("fecha", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return { data: rows, error: null as null };
    }

    async function fetchAllComprobantes() {
      const PAGE = 1000;
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client!
          .from("comprobantes")
          .select("*")
          .eq("almacen", almacen)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return { data: rows, error: null as null };
    }

    // La única consulta de todo el store que no es de un solo almacén: un
    // traspaso lo puede ver tanto quien lo envió como quien lo recibe.
    async function fetchAllTraspasos() {
      const PAGE = 1000;
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client!
          .from("traspasos")
          .select("*")
          .or(`almacen_origen.eq.${almacen},almacen_destino.eq.${almacen}`)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return { data: rows, error: null as null };
    }

    // Catálogo maestro: sin .eq("almacen", ...) a propósito, es la misma
    // tabla para cualquier cuenta (ver supabase/migration-fase17.sql). Ya
    // no tiene código — la identidad es `id`.
    async function fetchAllProductos() {
      const PAGE = 1000;
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client!
          .from("productos")
          .select("*")
          .order("descripcion", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return { data: rows, error: null as null };
    }

    // Mis propios códigos locales (sí lleva .eq("almacen", ...) — cada
    // almacén tiene su propia numeración, ver migration-fase17.sql).
    async function fetchMisProductoCodigos() {
      const PAGE = 1000;
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client!
          .from("producto_codigos")
          .select("producto_id, codigo")
          .eq("almacen", almacen)
          .range(from, from + PAGE - 1);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return { data: rows, error: null as null };
    }

    async function loadFromSupabase() {
      const [movementResult, categoryResult, comprobanteResult, traspasoResult, productoResult, codigosResult] = await Promise.all([
        fetchAllMovements(),
        client!.from("categories").select("name").eq("almacen", almacen).order("name"),
        fetchAllComprobantes(),
        fetchAllTraspasos(),
        fetchAllProductos(),
        fetchMisProductoCodigos(),
      ]);

      if (movementResult.error) {
        console.error("Error cargando movimientos desde Supabase:", movementResult.error);
        toast.error("No se pudieron cargar los movimientos. Revisa tu conexión.");
      } else {
        setMovements((movementResult.data ?? []).map(movementFromRow));
      }

      if (comprobanteResult.error) {
        console.error("Error cargando comprobantes desde Supabase:", comprobanteResult.error);
      } else {
        setComprobantes((comprobanteResult.data ?? []).map(comprobanteFromRow));
      }

      if (categoryResult.error) {
        console.error("Error cargando categorías desde Supabase:", categoryResult.error);
        toast.error("No se pudieron cargar las categorías.");
      } else if (categoryResult.data?.length) {
        setDbCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...categoryResult.data.map((row) => row.name)])));
      }

      if (traspasoResult.error) {
        console.error("Error cargando traspasos desde Supabase:", traspasoResult.error);
      } else {
        setTraspasos((traspasoResult.data ?? []).map(traspasoFromRow));
      }

      if (productoResult.error || codigosResult.error) {
        console.error(
          "Error cargando el catálogo de productos desde Supabase:",
          productoResult.error ?? codigosResult.error,
        );
        toast.error("No se pudo cargar el catálogo de productos.");
      } else {
        const maestro = (productoResult.data ?? []).map(productoMaestroFromRow);
        const porId = new Map(maestro.map((p) => [p.id, p]));
        const mios: Producto[] = [];
        for (const row of codigosResult.data ?? []) {
          const m = porId.get(String(row.producto_id ?? ""));
          if (m) mios.push(productoLocal(m, String(row.codigo ?? "")));
        }
        setCatalogoMaestro(maestro);
        setProductos(mios);
      }
    }

    void loadFromSupabase();
  }, [toast, almacen]);

  const inventory: InventoryItem[] = Array.from(buildInventory(movements).values());
  const numeros = calcularNumeros(comprobantes);

  // Entero que le tocará al próximo comprobante de ese tipo, dentro del año en curso.
  function siguienteNumeroInt(tipo: MovementType): number {
    const periodo = String(new Date().getFullYear());
    return (
      comprobantes
        .filter((c) => c.tipo === tipo && c.periodo === periodo)
        .reduce((mx, c) => Math.max(mx, c.numero), 0) + 1
    );
  }

  function proximoNumero(tipo: MovementType): string {
    return `${PREFIJO[tipo]}-${siguienteNumeroInt(tipo)}`;
  }

  // Arma el comprobante congelado de un registro a partir de sus movimientos.
  function construirComprobante(ms: Movement[]): Comprobante {
    return {
      id: crypto.randomUUID(),
      tipo: ms[0].tipo,
      numero: siguienteNumeroInt(ms[0].tipo),
      periodo: String(new Date().getFullYear()),
      fecha: ms[0].fecha,
      area: ms[0].area,
      responsable: ms[0].responsable,
      observaciones: ms[0].motivo || undefined,
      items: ms.map((m) => ({
        codigo: m.codigo,
        descripcion: m.descripcion,
        cantidad: m.cantidad,
        unidadMedida: m.unidadMedida || "UNID",
      })),
      movementIds: ms.map((m) => m.id),
      createdAt: ms[0].createdAt ?? new Date().toISOString(),
    };
  }

  // Guarda el comprobante en Supabase después de que sus movimientos ya se
  // guardaron. Si falla, quita el comprobante optimista (los movimientos
  // quedan, pero sin número) y avisa.
  function persistirComprobante(comp: Comprobante) {
    if (!supabase) return;
    void supabase
      .from("comprobantes")
      .insert(comprobanteToRow(comp, almacen))
      .then(({ error }) => {
        if (error) {
          console.error("Error guardando comprobante en Supabase:", error);
          setComprobantes((prev) => prev.filter((c) => c.id !== comp.id));
          toast.error(
            `Los movimientos se guardaron, pero no el comprobante ${etiquetaComprobante(comp)}.`,
          );
        }
      });
  }

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

  // Siguiente código correlativo: máximo código numérico de MI PROPIA
  // lista de productos + 1. `productos` ya viene scopeado a mi almacén
  // (ver loadFromSupabase), así que esto es automáticamente per-almacén —
  // cada almacén tiene su propia secuencia, empieza en 1.
  function nextCodigo(): string {
    let max = 0;
    for (const p of productos) {
      const n = parseInt(p.codigo.trim(), 10);
      if (!Number.isNaN(n) && String(n) === p.codigo.trim() && n > max) {
        max = n;
      }
    }
    return String(max + 1);
  }

  // Da de alta un producto EN MI ALMACÉN, con el código que eligió la
  // persona (o el correlativo automático de `nextCodigo`). Si `productoId`
  // viene (la persona confirmó que ya existe en el catálogo maestro — ver
  // NewProductEntryForm), solo se crea mi fila en `producto_codigos`: NO
  // se toca la identidad compartida, ya existe. Si viene `nuevo`, primero
  // se crea la identidad en el catálogo maestro y recién después mi código
  // local — con rollback del maestro si el segundo insert falla, para no
  // dejar una identidad húerfana sin ningún almacén que la use.
  async function registrarProductoEnAlmacen(input: RegistrarProductoInput): Promise<RegistrarProductoResult> {
    if (!supabase) return { error: "No hay conexión con el servidor.", codigo: null };
    const client = supabase;
    const codigo = input.codigo.toUpperCase().trim();

    let maestro: ProductoMaestro;
    let creado = false;
    if ("productoId" in input) {
      const existente = catalogoMaestro.find((p) => p.id === input.productoId);
      if (!existente) {
        return { error: "Ese producto ya no está en el catálogo compartido. Vuelve a intentarlo.", codigo: null };
      }
      maestro = existente;
    } else {
      const { data, error } = await client
        .from("productos")
        .insert(productoMaestroToRow(input.nuevo, almacen))
        .select()
        .single();
      if (error || !data) {
        console.error("Error creando producto en el catálogo:", error);
        return { error: "No se pudo crear el producto en el catálogo. Vuelve a intentarlo.", codigo: null };
      }
      maestro = productoMaestroFromRow(data);
      creado = true;
    }

    const { error: codigoError } = await client
      .from("producto_codigos")
      .insert({ almacen, producto_id: maestro.id, codigo });
    if (codigoError) {
      console.error("Error asignando código local:", codigoError);
      if (creado) {
        void client.from("productos").delete().eq("id", maestro.id);
      }
      if (codigoError.code === "23505") {
        return { error: "Ese código ya está en uso en tu almacén. Elige otro.", codigo: null };
      }
      return { error: "No se pudo registrar el producto en tu almacén. Vuelve a intentarlo.", codigo: null };
    }

    if (creado) setCatalogoMaestro((prev) => [...prev, maestro]);
    setProductos((prev) => [...prev, productoLocal(maestro, codigo)]);
    return { error: null, codigo };
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
      createdAt: new Date().toISOString(),
    };
    // Alta de producto nuevo = una Entrada. Genera su comprobante (número
    // E-N); las entradas NO se muestran en el módulo Comprobantes, ese es
    // solo para las copias de salidas impresas.
    const comp = construirComprobante([newM]);
    setMovements((prev) => [...prev, newM]);
    setComprobantes((prev) => [...prev, comp]);
    if (supabase) {
      void supabase.from("movements").insert(movementToRow(newM, almacen)).then(({ error }) => {
        if (error) {
          console.error("Error guardando movimiento en Supabase:", error);
          setMovements((prev) => prev.filter((x) => x.id !== newM.id));
          setComprobantes((prev) => prev.filter((c) => c.id !== comp.id));
          toast.error("El movimiento no se guardó en el servidor. Vuelve a intentarlo.");
        } else {
          persistirComprobante(comp);
          toast.success(`${newM.tipo} de "${newM.descripcion}" guardada (${etiquetaComprobante(comp)}).`);
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

    // Un solo created_at para todo el lote: comparten número de documento.
    const loteCreatedAt = new Date().toISOString();
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
        createdAt: loteCreatedAt,
      };
    });
    const newIds = new Set(newMs.map((m) => m.id));
    // Entradas y salidas generan comprobante (número E-N / S-N). La "copia"
    // reimprimible del módulo Comprobantes es solo para salidas.
    const comp = construirComprobante(newMs);

    setMovements((prev) => [...prev, ...newMs]);
    setComprobantes((prev) => [...prev, comp]);

    if (supabase) {
      const tipo = list[0].tipo;
      void supabase
        .from("movements")
        .insert(newMs.map((m) => movementToRow(m, almacen)))
        .then(({ error }) => {
          if (error) {
            console.error("Error guardando movimientos en Supabase:", error);
            setMovements((prev) => prev.filter((m) => !newIds.has(m.id)));
            setComprobantes((prev) => prev.filter((c) => c.id !== comp.id));
            toast.error(
              `No se guardaron los ${newMs.length} movimientos. Vuelve a intentarlo.`
            );
          } else {
            persistirComprobante(comp);
            toast.success(
              `${newMs.length} movimiento(s) de ${tipo} guardados (${etiquetaComprobante(comp)}).`,
            );
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
      void supabase.from("movements").upsert(movementToRow(merged, almacen)).then(({ error }) => {
        if (error) {
          console.error("Error actualizando movimiento en Supabase:", error);
          toast.error("El cambio no se guardó en el servidor. Vuelve a intentarlo.");
        }
      });
    }
    return null;
  }

  // Edita el producto: descripción/unidad/categoría/imagen se actualizan en
  // el catálogo MAESTRO (afecta a los dos almacenes, a propósito — es la
  // misma identidad compartida); el código es LOCAL a MI almacén
  // (producto_codigos) — renombrarlo ya NO toca al otro almacén (antes,
  // con el código como PK compartida de productos, un rename cascadeaba
  // el código también en el otro almacén sin que nadie se lo pidiera).
  // área/costo/stock mínimo son campos propios de mis movimientos.
  function updateProduct(oldCodigo: string, updated: ProductPatch) {
    const oldUpper = oldCodigo.toUpperCase().trim();
    const newUpper = updated.codigo.toUpperCase().trim();
    const mio = productos.find((p) => p.codigo.toUpperCase().trim() === oldUpper);
    if (!mio) return;
    const productoId = mio.id;

    setMovements((prev) =>
      prev.map((m) =>
        m.codigo.toUpperCase().trim() === oldUpper
          ? {
              ...m,
              codigo: newUpper,
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
    setProductos((prev) =>
      prev.map((p) =>
        p.id === productoId
          ? {
              ...p,
              codigo: newUpper,
              descripcion: updated.descripcion.trim(),
              unidadMedida: updated.unidadMedida !== undefined ? updated.unidadMedida : p.unidadMedida,
              categoria: updated.categoria || p.categoria,
              imagen: updated.imagen !== undefined ? updated.imagen : p.imagen,
            }
          : p
      )
    );
    setCatalogoMaestro((prev) =>
      prev.map((p) =>
        p.id === productoId
          ? {
              ...p,
              descripcion: updated.descripcion.trim(),
              unidadMedida: updated.unidadMedida !== undefined ? updated.unidadMedida : p.unidadMedida,
              categoria: updated.categoria || p.categoria,
              imagen: updated.imagen !== undefined ? updated.imagen : p.imagen,
            }
          : p
      )
    );

    if (!supabase) return;
    const client = supabase;

    const catalogoPatch: Record<string, unknown> = {
      descripcion: updated.descripcion.trim(),
      categoria: updated.categoria ?? null,
      imagen: updated.imagen ?? null,
      updated_at: new Date().toISOString(),
    };
    if (updated.unidadMedida !== undefined) catalogoPatch.unidad_medida = updated.unidadMedida || null;

    void client
      .from("productos")
      .update(catalogoPatch)
      .eq("id", productoId)
      .then(({ error }) => {
        if (error) {
          console.error("Error actualizando el catálogo de productos:", error);
          toast.error("El producto no se actualizó en el catálogo compartido. Vuelve a intentarlo.");
        }
      });

    const renombrar =
      newUpper !== oldUpper
        ? client.from("producto_codigos").update({ codigo: newUpper }).eq("almacen", almacen).eq("codigo", oldUpper)
        : Promise.resolve({ error: null as { code?: string } | null });

    void renombrar.then(({ error }) => {
      if (error) {
        console.error("Error renombrando el código local:", error);
        toast.error(
          error.code === "23505"
            ? "Ese código ya está en uso en tu almacén."
            : "El código no se pudo renombrar en tu almacén. Vuelve a intentarlo.",
        );
        return;
      }
      const patch: Record<string, unknown> = {
        descripcion: updated.descripcion.trim(),
        area: updated.area,
        categoria: updated.categoria ?? null,
        imagen: updated.imagen ?? null,
      };
      if (updated.unidadMedida !== undefined) patch.unidad_medida = updated.unidadMedida || null;
      if (updated.costo !== undefined) patch.costo = updated.costo;
      if (updated.stockMinimo !== undefined) patch.stock_minimo = updated.stockMinimo;
      void client
        .from("movements")
        .update(patch)
        .eq("codigo", newUpper)
        .eq("almacen", almacen)
        .then(({ error: movError }) => {
          if (movError) {
            console.error("Error actualizando producto en Supabase:", movError);
            toast.error("El producto no se actualizó en el servidor. Vuelve a intentarlo.");
          }
        });
    });
  }

  function deleteMovement(id: string) {
    setMovements((prev) => prev.filter((m) => m.id !== id));
    if (supabase) {
      void supabase.from("movements").delete().eq("id", id).eq("almacen", almacen).then(({ error }) => {
        if (error) {
          console.error("Error eliminando movimiento en Supabase:", error);
          toast.error("El movimiento no se eliminó en el servidor.");
        }
      });
    }
  }

  // Borra solo MIS movimientos de este código — el producto sigue
  // existiendo en el catálogo maestro para el otro almacén. También libero
  // mi código local (producto_codigos): si vuelvo a necesitar este
  // producto, `nextCodigo`/la búsqueda por nombre lo resuelven de nuevo.
  function deleteProduct(codigo: string) {
    const upper = codigo.toUpperCase().trim();
    setMovements((prev) => prev.filter((m) => m.codigo.toUpperCase().trim() !== upper));
    setProductos((prev) => prev.filter((p) => p.codigo.toUpperCase().trim() !== upper));
    if (supabase) {
      void supabase.from("movements").delete().ilike("codigo", upper).eq("almacen", almacen).then(({ error }) => {
        if (error) {
          console.error("Error eliminando producto en Supabase:", error);
          toast.error("El producto no se eliminó en el servidor.");
          return;
        }
        void supabase!.from("producto_codigos").delete().eq("almacen", almacen).eq("codigo", upper).then(({ error: codigoError }) => {
          if (codigoError) {
            console.error("Error liberando el código local:", codigoError);
          }
        });
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
    const { corte, marca, archivados, saldos } = construirCierre(movements, anio);
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
          .insert(saldos.map((m) => movementToRow(m, almacen)))
          .select("id");
        if (error || !data || data.length !== saldos.length) {
          console.error("Cierre anual: error creando saldos iniciales", error);
          if (data && data.length) {
            await supabase.from("movements").delete().in("id", data.map((r) => String(r.id))).eq("almacen", almacen);
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
        const { error } = await supabase.from("movements").delete().in("id", chunk).eq("almacen", almacen);
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

    // 4) Limpiar también los comprobantes del periodo cerrado (best-effort: la
    //    numeración del año nuevo ya reinicia por `periodo`, esto es housekeeping).
    const compIds = comprobantes.filter((c) => c.fecha <= corte).map((c) => c.id);
    if (compIds.length) {
      setComprobantes((prev) => prev.filter((c) => c.fecha > corte));
      if (supabase) {
        for (let i = 0; i < compIds.length; i += 150) {
          const { error } = await supabase
            .from("comprobantes")
            .delete()
            .in("id", compIds.slice(i, i + 150))
            .eq("almacen", almacen);
          if (error) {
            console.error("Cierre anual: error borrando comprobantes del periodo", error);
            break;
          }
        }
      }
    }

    return {
      error: null,
      archivados: archivados.length,
      saldosCreados: saldosYaExisten ? 0 : saldos.length,
      borrados: ids.length,
    };
  }

  // Envía un traspaso: descuenta MI stock al toque (Salida "suelta", sin
  // comprobante E-/S- — el documento de traspaso ya es su propio papel, como
  // los saldos de cierrarAnio) y crea el registro "pendiente" que el destino
  // va a poder ver y recibir. Verificación fuerte (con `.select("id")`) en
  // vez del simple "sin error" de addMovements: acá perder el insert en
  // silencio significaría mercadería que salió de mi almacén pero nunca
  // aparece pendiente en el otro — se pierde, no es solo un comprobante sin número.
  async function enviarTraspaso(input: EnviarTraspasoInput): Promise<EnviarTraspasoResult> {
    if (input.items.length === 0) return { error: "El carrito está vacío.", numero: null };
    if (!supabase) return { error: "No hay conexión con el servidor.", numero: null };

    const itemsNorm: TraspasoItem[] = input.items.map((it) => ({
      ...it,
      codigo: it.codigo.toUpperCase().trim(),
      descripcion: it.descripcion.trim(),
    }));

    // Chequeo de stock acumulado (dos líneas del mismo código se descuentan juntas).
    const inv = buildInventory(movements);
    const running = new Map<string, number>();
    for (const it of itemsNorm) {
      const disponible = running.has(it.codigo) ? (running.get(it.codigo) as number) : inv.get(it.codigo)?.cantidadDisponible ?? 0;
      const restante = disponible - it.cantidad;
      if (restante < 0) {
        return { error: `Stock insuficiente para "${it.descripcion}". Disponible: ${Math.max(0, disponible)}.`, numero: null };
      }
      running.set(it.codigo, restante);
    }

    const destinoNombre = cuentaPorAlmacen(input.almacenDestino)?.nombre ?? input.almacenDestino;
    const responsable = input.responsable.toUpperCase().trim();
    const motivo = input.motivo?.trim() || undefined;
    const loteCreatedAt = new Date().toISOString();
    const salidaMs: Movement[] = itemsNorm.map((it) => ({
      id: crypto.randomUUID(),
      codigo: it.codigo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      unidadMedida: it.unidadMedida,
      costo: it.costo,
      stockMinimo: 0,
      valor: Math.round(it.costo * it.cantidad * 100) / 100,
      fecha: input.fecha,
      responsable,
      area: `Traspaso a ${destinoNombre}`,
      categoria: it.categoria,
      tipo: "Salida",
      motivo,
      createdAt: loteCreatedAt,
    }));

    const { data, error } = await supabase
      .from("movements")
      .insert(salidaMs.map((m) => movementToRow(m, almacen)))
      .select("id");
    if (error || !data || data.length !== salidaMs.length) {
      console.error("Traspaso: error creando movimientos de salida", error);
      if (data && data.length) {
        await supabase.from("movements").delete().in("id", data.map((r) => String(r.id))).eq("almacen", almacen);
      }
      return { error: "No se pudo registrar la salida del traspaso. Vuelve a intentarlo.", numero: null };
    }
    setMovements((prev) => [...prev, ...salidaMs]);

    // El número lo asigna la función del lado de la base (atómica, no
    // depende de qué traspasos pueda ver esta cuenta) — ver
    // supabase/migration-fase14.sql. Si falla, se compensa igual que un
    // fallo del insert de arriba: los productos nunca terminaron de salir.
    const periodo = String(new Date().getFullYear());
    const { data: numeroData, error: numeroError } = await supabase.rpc("siguiente_numero_traspaso", {
      p_periodo: periodo,
    });
    if (numeroError || numeroData == null) {
      console.error("Traspaso: error generando el número", numeroError);
      const ids = salidaMs.map((m) => m.id);
      await supabase.from("movements").delete().in("id", ids).eq("almacen", almacen);
      setMovements((prev) => prev.filter((m) => !ids.includes(m.id)));
      return { error: "No se pudo generar el número del traspaso. Vuelve a intentarlo.", numero: null };
    }

    const traspaso: Traspaso = {
      id: crypto.randomUUID(),
      numero: numeroData as number,
      periodo,
      almacenOrigen: almacen,
      almacenDestino: input.almacenDestino,
      estado: "pendiente",
      fechaEnvio: input.fecha,
      responsableEnvio: responsable,
      motivo,
      items: itemsNorm,
      movementIdsSalida: salidaMs.map((m) => m.id),
      movementIdsEntrada: [],
      createdAt: loteCreatedAt,
    };

    const { error: tError } = await supabase.from("traspasos").insert(traspasoToRow(traspaso));
    if (tError) {
      console.error("Traspaso: error guardando el documento", tError);
      const ids = salidaMs.map((m) => m.id);
      await supabase.from("movements").delete().in("id", ids).eq("almacen", almacen);
      setMovements((prev) => prev.filter((m) => !ids.includes(m.id)));
      return { error: "Los productos no salieron del almacén: no se pudo guardar el traspaso. Vuelve a intentarlo.", numero: null };
    }

    setTraspasos((prev) => [traspaso, ...prev]);
    toast.success(`Traspaso ${etiquetaTraspaso(traspaso)} enviado a ${destinoNombre}.`);
    return { error: null, numero: traspaso.numero };
  }

  // Recibe un traspaso pendiente, línea por línea: lo que viene en
  // `resueltos` es lo que se ACEPTA (crea MIS movimientos de Entrada); lo
  // que falta de `t.items` respecto a eso se RECHAZA solo, sin pedir
  // motivo — se le restituye el stock al origen vía
  // `traspaso_restituir_rechazados` (esos movimientos son de OTRO almacén;
  // RLS no me deja tocarlos directo, por eso la función). Si no se acepta
  // nada, es un rechazo total y se delega a `cancelarTraspaso`.
  //
  // Orden a propósito: 1) creo mis movimientos de Entrada (verificado),
  // 2) restituyo lo rechazado, 3) recién ahí marco "recibido" (con guardia
  // `.eq("estado","pendiente")`). Si el paso 3 falla, se compensa borrando
  // lo del paso 1 — el paso 2 queda aplicado, pero es seguro: si se
  // reintenta todo de nuevo, restituir ids que ya no existen es un no-op.
  // Si fuera al revés (marcar "recibido" antes de crear los movimientos),
  // una falla ahí dejaría mostrando recibido sin haber sumado stock.
  async function recibirTraspaso(
    traspasoId: string,
    resueltos: ResueltoTraspasoItem[],
    responsable: string,
    fecha: string,
  ): Promise<string | null> {
    const t = traspasos.find((x) => x.id === traspasoId);
    if (!t) return "No se encontró el traspaso.";
    if (t.estado !== "pendiente") return "Este traspaso ya no está pendiente.";
    if (t.almacenDestino !== almacen) return "Este traspaso no es para tu almacén.";
    if (!supabase) return "No hay conexión con el servidor.";

    if (resueltos.length === 0) {
      return cancelarTraspaso(traspasoId, "Rechazado: no se aceptó ningún producto.");
    }

    // `productoId` es la identidad compartida (catálogo maestro):
    // descripción, unidad, costo y categoría se toman del snapshot que
    // mandó el origen (t.items), no hay que volver a pedirlos — lo único
    // que decide el destino por línea es cuánto acepta y en qué área.
    const itemsPorProductoId = new Map(t.items.map((it) => [it.productoId, it]));
    const responsableUp = responsable.toUpperCase().trim();
    const loteCreatedAt = new Date().toISOString();

    // Resuelve MI código local para cada línea aceptada: si ya tengo uno
    // asignado a este producto, lo reuso; si no, le doy el siguiente de MI
    // propia secuencia — nunca hay que crear nada a mano. Corre ANTES de
    // insertar los movimientos porque movements.codigo tiene FK a
    // producto_codigos(almacen, codigo): tiene que existir primero.
    let siguienteLibre = parseInt(nextCodigo(), 10);
    const codigosPorProductoId = new Map<string, string>();
    const nuevosCodigos: { producto_id: string; codigo: string }[] = [];
    for (const r of resueltos) {
      const mio = productos.find((p) => p.id === r.productoId);
      if (mio) {
        codigosPorProductoId.set(r.productoId, mio.codigo);
        continue;
      }
      const yaAsignado = nuevosCodigos.find((n) => n.producto_id === r.productoId);
      if (yaAsignado) {
        codigosPorProductoId.set(r.productoId, yaAsignado.codigo);
        continue;
      }
      const codigo = String(siguienteLibre++);
      nuevosCodigos.push({ producto_id: r.productoId, codigo });
      codigosPorProductoId.set(r.productoId, codigo);
    }

    if (nuevosCodigos.length) {
      const { error: codigosError } = await supabase
        .from("producto_codigos")
        .insert(nuevosCodigos.map((n) => ({ almacen, producto_id: n.producto_id, codigo: n.codigo })));
      if (codigosError) {
        console.error("Recepción de traspaso: error asignando código local", codigosError);
        return "No se pudo asignar el código en tu almacén. Vuelve a intentarlo.";
      }
    }

    const entradaMs: Movement[] = resueltos.map((r) => {
      const origen = itemsPorProductoId.get(r.productoId);
      return {
        id: crypto.randomUUID(),
        codigo: codigosPorProductoId.get(r.productoId)!,
        descripcion: (origen?.descripcion ?? "").trim(),
        cantidad: r.cantidad,
        unidadMedida: origen?.unidadMedida,
        costo: origen?.costo ?? 0,
        stockMinimo: 0,
        valor: Math.round((origen?.costo ?? 0) * r.cantidad * 100) / 100,
        fecha,
        responsable: responsableUp,
        area: r.area,
        categoria: origen?.categoria,
        tipo: "Entrada",
        motivo: `Traspaso ${etiquetaTraspaso(t)} de ${cuentaPorAlmacen(t.almacenOrigen)?.nombre ?? t.almacenOrigen}`,
        createdAt: loteCreatedAt,
      };
    });

    const { data, error } = await supabase
      .from("movements")
      .insert(entradaMs.map((m) => movementToRow(m, almacen)))
      .select("id");
    if (error || !data || data.length !== entradaMs.length) {
      console.error("Recepción de traspaso: error creando movimientos de entrada", error);
      if (data && data.length) {
        await supabase.from("movements").delete().in("id", data.map((r2) => String(r2.id))).eq("almacen", almacen);
      }
      if (nuevosCodigos.length) {
        await supabase.from("producto_codigos").delete().eq("almacen", almacen).in("codigo", nuevosCodigos.map((n) => n.codigo));
      }
      return "No se pudo registrar la recepción. Vuelve a intentarlo.";
    }
    setMovements((prev) => [...prev, ...entradaMs]);
    if (nuevosCodigos.length) {
      setProductos((prev) => [
        ...prev,
        ...nuevosCodigos.map((n) => productoLocal(catalogoMaestro.find((p) => p.id === n.producto_id)!, n.codigo)),
      ]);
    }

    // Qué se aceptó y qué no, comparando contra el snapshot original por
    // producto — movementIdsSalida[i] corresponde a items[i] (mismo orden,
    // ver enviarTraspaso).
    const aceptadosIds = new Set(resueltos.map((r) => r.productoId));
    const itemsRechazados: TraspasoItem[] = t.items.filter((it) => !aceptadosIds.has(it.productoId));
    const movementIdsARestituir: string[] = [];
    const movementIdsQueQuedan: string[] = [];
    t.items.forEach((it, idx) => {
      const movId = t.movementIdsSalida[idx];
      if (!movId) return;
      if (aceptadosIds.has(it.productoId)) {
        movementIdsQueQuedan.push(movId);
      } else {
        movementIdsARestituir.push(movId);
      }
    });

    if (movementIdsARestituir.length) {
      const { error: restError } = await supabase.rpc("traspaso_restituir_rechazados", {
        traspaso_id: traspasoId,
        movement_ids: movementIdsARestituir,
      });
      if (restError) {
        console.error("Recepción parcial: error restituyendo stock de origen", restError);
        const ids = entradaMs.map((m) => m.id);
        await supabase.from("movements").delete().in("id", ids).eq("almacen", almacen);
        setMovements((prev) => prev.filter((m) => !ids.includes(m.id)));
        return "No se pudo restituir el stock de los productos rechazados. Vuelve a intentarlo.";
      }
    }

    const itemsRecibidos: TraspasoItemRecibido[] = resueltos.map((r) => {
      const origen = itemsPorProductoId.get(r.productoId);
      return {
        productoId: r.productoId,
        codigo: codigosPorProductoId.get(r.productoId) ?? "",
        descripcion: (origen?.descripcion ?? "").trim(),
        cantidad: r.cantidad,
        unidadMedida: origen?.unidadMedida,
        costo: origen?.costo ?? 0,
        categoria: origen?.categoria,
        area: r.area,
      };
    });

    const { data: updData, error: updError } = await supabase
      .from("traspasos")
      .update({
        estado: "recibido",
        fecha_recepcion: fecha,
        responsable_recepcion: responsableUp,
        items_recibidos: itemsRecibidos,
        items_rechazados: itemsRechazados.length ? itemsRechazados : null,
        movement_ids_entrada: entradaMs.map((m) => m.id),
        movement_ids_salida: movementIdsQueQuedan,
      })
      .eq("id", traspasoId)
      .eq("estado", "pendiente")
      .eq("almacen_destino", almacen)
      .select("id");

    if (updError || !updData || updData.length !== 1) {
      console.error("Recepción de traspaso: no se pudo marcar como recibido", updError);
      const ids = entradaMs.map((m) => m.id);
      await supabase.from("movements").delete().in("id", ids).eq("almacen", almacen);
      setMovements((prev) => prev.filter((m) => !ids.includes(m.id)));
      return "Este traspaso ya no estaba pendiente (puede que se haya cancelado). No se registró la recepción.";
    }

    setTraspasos((prev) =>
      prev.map((x) =>
        x.id === traspasoId
          ? {
              ...x,
              estado: "recibido" as TraspasoEstado,
              fechaRecepcion: fecha,
              responsableRecepcion: responsableUp,
              itemsRecibidos,
              itemsRechazados: itemsRechazados.length ? itemsRechazados : undefined,
              movementIdsEntrada: entradaMs.map((m) => m.id),
              movementIdsSalida: movementIdsQueQuedan,
            }
          : x,
      ),
    );
    toast.success(
      itemsRechazados.length
        ? `Traspaso ${etiquetaTraspaso(t)} recibido (${itemsRechazados.length} producto${itemsRechazados.length === 1 ? "" : "s"} rechazado${itemsRechazados.length === 1 ? "" : "s"}).`
        : `Traspaso ${etiquetaTraspaso(t)} recibido.`,
    );
    return null;
  }

  // Cancela (origen, antes de que lo reciban) o rechaza (destino, si algo
  // está mal) un traspaso pendiente. Acá al revés que recibirTraspaso: la
  // bandera se actualiza PRIMERO (con guardia), y solo si eso confirma se
  // restituyen los movimientos de salida del origen. Si eso después fallara
  // a medias, el traspaso ya quedó claramente "cancelado" (nadie puede
  // intentar recibirlo) y la restitución pendiente es retomable sin
  // duplicar nada. Al revés sería peor: un traspaso "pendiente" apuntando a
  // movimientos que ya no existen podría dejar que destino reciba stock que
  // en realidad nunca se descontó del origen.
  //
  // Quién restituye depende de quién soy: si soy el origen, son mis propios
  // movimientos — los borro directo. Si soy el destino rechazando, esos
  // movimientos son de OTRO almacén; RLS no me deja tocarlos, así que uso
  // `traspaso_restituir_rechazados` (la misma función que usa la recepción
  // parcial) en vez de un delete directo.
  async function cancelarTraspaso(traspasoId: string, motivo?: string): Promise<string | null> {
    const t = traspasos.find((x) => x.id === traspasoId);
    if (!t) return "No se encontró el traspaso.";
    if (t.estado !== "pendiente") return "Este traspaso ya no está pendiente.";
    if (t.almacenOrigen !== almacen && t.almacenDestino !== almacen) {
      return "Este traspaso no te pertenece.";
    }
    if (!supabase) return "No hay conexión con el servidor.";

    const motivoLimpio = motivo?.trim() || undefined;
    const { data: updData, error: updError } = await supabase
      .from("traspasos")
      .update({ estado: "cancelado", motivo_cancelacion: motivoLimpio ?? null })
      .eq("id", traspasoId)
      .eq("estado", "pendiente")
      .select("id");

    if (updError || !updData || updData.length !== 1) {
      console.error("Cancelar traspaso: no se pudo actualizar", updError);
      return "No se pudo cancelar (puede que ya haya cambiado de estado). Refresca la lista.";
    }

    setTraspasos((prev) =>
      prev.map((x) =>
        x.id === traspasoId ? { ...x, estado: "cancelado" as TraspasoEstado, motivoCancelacion: motivoLimpio } : x,
      ),
    );

    if (t.movementIdsSalida.length) {
      if (t.almacenOrigen === almacen) {
        const ids = t.movementIdsSalida;
        for (let i = 0; i < ids.length; i += 150) {
          const chunk = ids.slice(i, i + 150);
          const { error } = await supabase.from("movements").delete().in("id", chunk).eq("almacen", almacen);
          if (error) {
            console.error("Cancelar traspaso: error borrando movimientos de salida", error);
            toast.error(
              `Traspaso ${etiquetaTraspaso(t)} cancelado, pero no se pudo restituir todo el stock. Revísalo en Salidas.`,
            );
            return null;
          }
        }
        setMovements((prev) => prev.filter((m) => !ids.includes(m.id)));
      } else {
        const { error } = await supabase.rpc("traspaso_restituir_rechazados", {
          traspaso_id: traspasoId,
          movement_ids: t.movementIdsSalida,
        });
        if (error) {
          console.error("Rechazar traspaso: error restituyendo stock de origen", error);
          toast.error(
            `Traspaso ${etiquetaTraspaso(t)} rechazado, pero no se pudo restituir el stock del origen. Avísale al otro almacén.`,
          );
          return null;
        }
      }
    }

    toast.success(`Traspaso ${etiquetaTraspaso(t)} cancelado.`);
    return null;
  }

  return (
    <Ctx.Provider
      value={{
        almacen,
        movements,
        inventory,
        comprobantes,
        numeros,
        proximoNumero,
        categories,
        unidades,
        areas,
        productos,
        catalogoMaestro,
        nextCodigo,
        registrarProductoEnAlmacen,
        addMovement,
        addMovements,
        updateMovement,
        updateProduct,
        deleteMovement,
        deleteProduct,
        cerrarAnio,
        traspasos,
        enviarTraspaso,
        recibirTraspaso,
        cancelarTraspaso,
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

