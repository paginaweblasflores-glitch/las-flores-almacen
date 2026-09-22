import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Cuentas de acceso. El "usuario" es lo que se elige en el login; mapea a un
// correo real de Supabase Auth (esa cuenta se crea a mano en el Dashboard,
// ver README). Cada cuenta trae su propia marca (logo + nombre) para el panel
// y su propia clave de "almacen": los datos de movements/comprobantes/
// categories están separados por esa clave (ver supabase/migration-fase6.sql
// — RLS impide que una cuenta vea o escriba filas de otro almacén, no es
// solo un filtro de la app). Agregar una cuenta nueva necesita: una entrada
// acá, el usuario en Authentication → Users, y su línea en las políticas RLS
// de esa migración.
export interface CuentaAlmacen {
  usuario: string;
  email: string;
  nombre: string;
  tagline?: string; // subtítulo del login, ej. "desde 1980"
  logo: string;
  almacen: string; // clave de aislamiento de datos (coincide con la migración)
  esAdmin?: boolean; // ve y escribe CUALQUIER almacén (RLS, ver migration-fase9.sql);
                      // "almacen" acá no se usa nunca para filtrar datos reales
}

export const CUENTAS: CuentaAlmacen[] = [
  {
    usuario: "Almacen Las Flores",
    email: "almacen2026@almacen.local",
    nombre: "Restaurante Las Flores",
    tagline: "desde 1980",
    logo: "/logo.png",
    almacen: "las-flores",
  },
  {
    usuario: "Almacen Hotel Umaru",
    email: "almacenumaru2026@almacen.local",
    nombre: "Hotel Umaru",
    logo: "/logo-umaru.jpg",
    almacen: "hotel-umaru",
  },
  {
    usuario: "Corporación Las Flores",
    email: "corporacion2026@almacen.local",
    nombre: "Corporación Las Flores",
    logo: "/logo.png",
    almacen: "admin",
    esAdmin: true,
  },
];

export const CUENTA_DEFECTO: CuentaAlmacen = CUENTAS[0];

export function cuentaPorUsuario(usuario: string): CuentaAlmacen | undefined {
  const buscado = usuario.trim().toLowerCase();
  return CUENTAS.find((c) => c.usuario.toLowerCase() === buscado);
}

export function cuentaPorEmail(email: string | undefined | null): CuentaAlmacen {
  const buscado = (email ?? "").trim().toLowerCase();
  return CUENTAS.find((c) => c.email.toLowerCase() === buscado) ?? CUENTA_DEFECTO;
}

export function cuentaPorAlmacen(almacen: string): CuentaAlmacen | undefined {
  return CUENTAS.find((c) => c.almacen === almacen);
}
