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

// Factor por defecto para sugerir el precio de venta a partir del costo.
// El Excel de Rio usa costo ≈ precio × 0,7 (margen ≈ +42,86 %).
// Rio puede sobrescribir el precio sugerido en el formulario.
export const MARGEN_PRECIO_VENTA = 1 / 0.7;

// Avisos escalonados según la cantidad total de movimientos guardados.
// Ajusta los límites aquí si hace falta; deben ir de menor a mayor.
export type NivelAviso = "info" | "warn" | "error";

export const AVISOS_VOLUMEN: {
  limite: number;
  nivel: NivelAviso;
  titulo: string;
  mensaje: string;
}[] = [
  {
    limite: 300,
    nivel: "info",
    titulo: "El almacén ya tiene muchos movimientos",
    mensaje:
      "Conviene hacer limpieza: en “Exportar Excel” descarga los movimientos antiguos (puedes hacerlo mes por mes) y elimínalos para mantener el sistema ágil.",
  },
  {
    limite: 15000,
    nivel: "warn",
    titulo: "Recordatorio: falta la limpieza de movimientos",
    mensaje:
      "Todavía no se hizo la limpieza. Exporta a Excel los movimientos antiguos (mes por mes) y bórralos de la base.",
  },
  {
    limite: 20000,
    nivel: "warn",
    titulo: "El sistema se puede poner lento",
    mensaje:
      "Son demasiados datos. Descarga a Excel los movimientos que ya no se usan y elimínalos ahora para no afectar el rendimiento.",
  },
  {
    limite: 25000,
    nivel: "error",
    titulo: "Contacta a los desarrolladores",
    mensaje:
      "La base de datos necesita optimización. Escribe a los desarrolladores para mejorar el rendimiento antes de seguir cargando más datos.",
  },
];

export interface Movement {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida?: string;
  costo: number;        // costo unitario
  precioVenta: number;  // precio de venta unitario
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
  precioVenta: number;  // precio de venta unitario más reciente
  stockMinimo: number;  // punto de reorden
  valor: number;        // alias de costo (compatibilidad)
  fechaActualizacion: string;
  responsable: string;
  area: string;
  categoria?: string;
  imagen?: string;
}

