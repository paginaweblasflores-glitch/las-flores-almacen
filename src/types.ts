export type MovementType = "Entrada" | "Salida";

export const DEFAULT_CATEGORIES = [
  "Atención y servicio",
  "Empaques y descartables",
  "Mantenimiento",
  "Tecnología y equipos",
  "Seguridad",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export const AREAS = [
  "Limpieza",
  "Almuerzo",
  "Cocina producción",
  "Trucha",
  "Cuy",
  "Gerencia",
  "Romero",
  "Bosco",
  "Administración",
  "Azafate",
  "Karaoke",
  "Repostería",
  "Oficina 1",
  "Oficina 2",
  "Oficina 3",
  "Trasferencia Umaru",
  "Horno",
  "Matadero",
  "Almacén 1",
  "Almacén 2",
  "Almacén 3",
  "Almacén de herramientas",
  "Almacén de maquinas",
  "Cuarto de mujeres",
  "Cuarto de varones",
  "pared",
] as const;

export type Area = (typeof AREAS)[number];

export const UNIDADES_MEDIDA = [
  "UNID",
  "PAQ",
  "CAJA",
  "DOCENA",
  "PAR",
  "JUEGO",
  "KG",
  "GR",
  "LT",
  "ML",
  "METRO",
  "ROLLO",
  "GALÓN",
  "BALDE",
  "BOLSA",
] as const;

export type UnidadMedida = (typeof UNIDADES_MEDIDA)[number];

export interface Movement {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida?: string;
  costo: number;        // costo unitario
  stockMinimo: number;  // punto de reorden del producto
  valor: number;        // valor total del movimiento (cantidad × costo)
  fecha: string;
  responsable: string;
  area: string;
  categoria?: string;
  tipo: MovementType;
  imagen?: string;
  motivo?: string;
}

export interface InventoryItem {
  codigo: string;
  descripcion: string;
  cantidadDisponible: number;
  unidadMedida?: string;
  costo: number;        // costo unitario más reciente
  stockMinimo: number;  // punto de reorden
  valor: number;        // alias de costo (compatibilidad)
  fechaActualizacion: string;
  responsable: string;
  area: string;
  categoria?: string;
  imagen?: string;
}

// Una línea del carrito de registro (entrada o salida de varios productos a la vez).
export interface CartLine {
  codigo: string;
  descripcion: string;
  unidadMedida?: string;
  costo: number;         // costo de referencia traído del inventario (para valorizar)
  categoria?: string;
  area?: string;         // área del producto en inventario (se hereda en las entradas)
  stockActual: number;   // snapshot de cantidadDisponible al agregar (solo visual)
  cantidad: number;      // editable, entero >= 1
}

// Datos para el comprobante impreso de una salida (varios ítems).
export interface TicketData {
  fecha: string;
  area: string;          // área destino
  responsable: string;
  items: { codigo: string; descripcion: string; cantidad: number; unidadMedida: string }[];
}

