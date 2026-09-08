/**
 * Normaliza texto para búsquedas de almacén:
 * minúsculas + sin acentos/tildes + espacios colapsados.
 * Así "Almacén", "ALMACEN" y "almacen" son equivalentes.
 */
export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Filtra una lista con criterio de almacén:
 *
 * 1. Consulta vacía  → devuelve todo.
 * 2. Si la consulta coincide EXACTA con el código de algún ítem
 *    (ignorando mayúsculas y acentos) → devuelve solo ese/esos.
 *    Si escribís un código y no existe, no aparece nada "parecido".
 * 3. Si no es un código exacto → exige que TODAS las palabras de la
 *    consulta aparezcan en el código o el texto del ítem, sin importar
 *    el orden. Escribir "copa" trae todas las copas; agregar palabras
 *    ("copa asa irlandes") va reduciendo hasta la que buscás.
 */
export function filtrarBusqueda<T>(
  items: T[],
  query: string,
  getCodigo: (it: T) => string,
  getTexto: (it: T) => string,
): T[] {
  const q = normalizar(query);
  if (!q) return items;

  const codigoExacto = items.filter((it) => normalizar(getCodigo(it)) === q);
  if (codigoExacto.length > 0) return codigoExacto;

  const palabras = q.split(" ").filter(Boolean);
  return items.filter((it) => {
    const heno = normalizar(`${getCodigo(it)} ${getTexto(it)}`);
    return palabras.every((p) => heno.includes(p));
  });
}
