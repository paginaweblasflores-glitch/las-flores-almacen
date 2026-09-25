-- Limpieza de las pruebas hechas en Hotel Umaru: movements/comprobantes ya se
-- vaciaron desde la app (Configuración → Vaciar almacén). Faltan los traspasos
-- históricos que involucran a Umaru (T-1 x2, T-2) — no hay borrado de
-- traspasos ya resueltos desde la interfaz, así que va directo por SQL.
delete from public.traspasos
where almacen_origen = 'hotel-umaru' or almacen_destino = 'hotel-umaru';
