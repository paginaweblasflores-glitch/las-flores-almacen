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
  almacenNombre: string; // nombre de la cuenta activa (Restaurante Las Flores, Hotel Umaru…)
  fecha: string;
  area: string;          // área destino
  responsable: string;
  observaciones?: string; // nota libre opcional
  items: { codigo: string; descripcion: string; cantidad: number; unidadMedida: string }[];
}

// La identidad compartida de un producto (descripción, unidad, categoría,
// imagen) es la misma fila para todos los almacenes — `id` es la clave
// real, interna, invisible para el usuario. El código que SÍ ve/imprime/
// busca cada almacén es independiente por almacén (tabla `producto_codigos`,
// ver supabase/migration-fase17.sql) — por eso acá siempre viene junto al
// `id`: es "mi código local para este producto", no una identidad en sí.
// El stock, costo y stock mínimo NO viven acá — eso sigue siendo 100% de
// cada almacén, en Movement/InventoryItem.
export interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  unidadMedida?: string;
  categoria?: string;
  imagen?: string;
}

// El catálogo maestro completo (los dos almacenes), SIN código — un mismo
// producto puede tener un código distinto en cada almacén, o ninguno
// todavía. Se usa para sugerir "¿ya existe esto?" al dar de alta un
// producto nuevo (por nombre, no por código) y en el buscador de Reportes.
export interface ProductoMaestro {
  id: string;
  descripcion: string;
  unidadMedida?: string;
  categoria?: string;
  imagen?: string;
}

export type TraspasoEstado = "pendiente" | "recibido" | "cancelado";

// Un producto tal como lo mandó el almacén de origen (snapshot al enviar).
// `productoId` es la identidad real (catálogo compartido) y es la llave
// que usa el destino para resolver SU PROPIO código local — `codigo` acá
// es el del ORIGEN, se guarda solo como dato informativo/auditoría, ya no
// como llave de nada (dos almacenes pueden tener códigos distintos para
// el mismo producto).
export interface TraspasoItem {
  productoId: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida?: string;
  costo: number;
  categoria?: string;
}

// Qué área eligió el destino para cada línea aceptada (nombre/unidad/costo/
// categoría ya vienen del catálogo compartido, no hace falta "resolverlos"
// a un producto propio — ver Producto en este mismo archivo).
export interface TraspasoItemRecibido extends TraspasoItem {
  area: string;
}

// Traspaso de mercadería entre almacenes: lo crea el origen (descuenta su
// stock al toque) y queda "pendiente" hasta que el destino lo recibe (recién
// ahí suma su propio stock) o lo rechaza. Es la única entidad que un almacén
// ve sin ser "dueño" exclusivo de la fila — ver supabase/migration-fase7.sql.
export interface Traspaso {
  id: string;
  numero: number;         // correlativo GLOBAL entre todos los almacenes ("T-1", "T-2"…), no por origen
  periodo: string;        // año; reinicia cada año, igual que E-/S-
  almacenOrigen: string;
  almacenDestino: string;
  estado: TraspasoEstado;
  fechaEnvio: string;
  responsableEnvio: string;
  motivo?: string;
  items: TraspasoItem[];
  movementIdsSalida: string[];
  fechaRecepcion?: string;
  responsableRecepcion?: string;
  itemsRecibidos?: TraspasoItemRecibido[];
  itemsRechazados?: TraspasoItem[]; // líneas que el destino rechazó (recepción parcial)
  movementIdsEntrada: string[];
  motivoCancelacion?: string; // por qué se canceló o rechazó
  createdAt: string;
}

// Datos para el comprobante impreso de un traspaso.
export interface TraspasoTicketData {
  numero: string;              // "T-1", "T-2"…
  fecha: string;
  almacenOrigenNombre: string;
  almacenDestinoNombre: string;
  responsable: string;
  motivo?: string;
  items: { codigo: string; descripcion: string; cantidad: number; unidadMedida: string }[];
}

