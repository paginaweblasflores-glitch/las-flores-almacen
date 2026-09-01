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

export interface Movement {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor: number;
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
  valor: number;
  fechaActualizacion: string;
  responsable: string;
  area: string;
  categoria?: string;
  imagen?: string;
}

