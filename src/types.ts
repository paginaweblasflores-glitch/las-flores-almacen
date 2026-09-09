export type MovementType = "Entrada" | "Salida";

export const DEFAULT_CATEGORIES = [
  "Atención y servicio",
  "Empaques y descartables",
  "Mantenimiento",
  "Tecnología y equipos",
  "Seguridad",
] as const;

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
  createdAt?: string;   // fecha/hora de registro (Supabase created_at); ordena el correlativo E-/S-
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

// Copia congelada de un registro (entrada o salida). Se guarda en la tabla
// `comprobantes` al registrar: número correlativo + la lista de productos tal
// como quedó. No cambia aunque después se edite o borre un movimiento.
export interface Comprobante {
  id: string;
  tipo: MovementType;
  numero: number;        // correlativo dentro del periodo
  periodo: string;       // año ("2026"); el correlativo reinicia cada año
  fecha: string;
  area: string;
  responsable: string;
  observaciones?: string;
  items: { codigo: string; descripcion: string; cantidad: number; unidadMedida: string }[];
  movementIds: string[]; // ids de los movements que lo componen
  createdAt: string;
}

// Datos para el comprobante impreso de una salida (varios ítems).
export interface TicketData {
  numero?: string;       // "S-1", "S-2"… (vacío si la salida es anterior a la numeración)
  fecha: string;
  area: string;          // área destino
  responsable: string;
  observaciones?: string; // nota libre opcional
  items: { codigo: string; descripcion: string; cantidad: number; unidadMedida: string }[];
}

