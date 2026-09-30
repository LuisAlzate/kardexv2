-- ==============================================================================
-- KARDEX V2 - SQL VIEWS & RPCS PARA SUPABASE
-- Ejecutar esto en el SQL Editor de Supabase después de crear las tablas
-- ==============================================================================

-- 1. Vista: getToolsWithStock
-- Esta vista calcula el stock actual de cada herramienta (bueno y malo).
CREATE OR REPLACE VIEW view_tools_with_stock AS
SELECT 
    h.id,
    h.nombre,
    h.marca,
    h.descripcion,
    h.codigo_referencia,
    h.num_serial,
    h.fecha_compra,
    h.estanteria,
    COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION', 'AJUSTE') AND COALESCE(km.estado_insumo, 'BUENA') = 'BUENA' THEN km.cantidad ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('SALIDA', 'MANTENIMIENTO') AND COALESCE(km.estado_insumo, 'BUENA') = 'BUENA' THEN km.cantidad ELSE 0 END), 0) as stock_bueno,
    COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION', 'AJUSTE') AND km.estado_insumo = 'MALA' THEN km.cantidad ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('SALIDA', 'MANTENIMIENTO') AND km.estado_insumo = 'MALA' THEN km.cantidad ELSE 0 END), 0) as stock_malo,
    -- total stock
    (COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION', 'AJUSTE') AND COALESCE(km.estado_insumo, 'BUENA') = 'BUENA' THEN km.cantidad ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('SALIDA', 'MANTENIMIENTO') AND COALESCE(km.estado_insumo, 'BUENA') = 'BUENA' THEN km.cantidad ELSE 0 END), 0)) +
    (COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION', 'AJUSTE') AND km.estado_insumo = 'MALA' THEN km.cantidad ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('SALIDA', 'MANTENIMIENTO') AND km.estado_insumo = 'MALA' THEN km.cantidad ELSE 0 END), 0)) as stock_total
FROM herramientas h
LEFT JOIN kardex_movimientos km ON h.id = km.herramienta_id
GROUP BY h.id;

-- 2. Vista: view_tools_in_maintenance
CREATE OR REPLACE VIEW view_tools_in_maintenance AS
SELECT 
    km.herramienta_id as id,
    km.herramienta_id,
    h.nombre as tool_nombre,
    h.codigo_referencia as tool_codigo,
    h.num_serial as tool_serial,
    CAST(SUM(km.cantidad) AS INTEGER) as balance,
    MAX(km.fecha) as fecha,
    MAX(km.observaciones) as observaciones
FROM kardex_movimientos km
JOIN herramientas h ON km.herramienta_id = h.id
WHERE km.tipo_movimiento = 'MANTENIMIENTO'
GROUP BY km.herramienta_id, h.nombre, h.codigo_referencia, h.num_serial
HAVING CAST(SUM(km.cantidad) AS INTEGER) > 0;

-- 3. Vista: view_assigned_tools
CREATE OR REPLACE VIEW view_assigned_tools AS
SELECT 
    (km.herramienta_id || '_' || COALESCE(km.trabajador_id::text, 'NULL') || '_' || COALESCE(km.ubicacion_id::text, 'NULL')) as id,
    km.herramienta_id,
    km.trabajador_id,
    km.ubicacion_id,
    h.nombre as tool_nombre,
    h.codigo_referencia as tool_codigo,
    h.num_serial as tool_serial,
    t.nombre as collaborator_nombre,
    u.nombre_obra as location_nombre,
    CAST(SUM(CASE WHEN km.tipo_movimiento = 'SALIDA' THEN km.cantidad ELSE 0 END) -
         SUM(CASE WHEN km.tipo_movimiento = 'DEVOLUCION' THEN km.cantidad ELSE 0 END) AS INTEGER) as balance,
    MAX(km.fecha) as fecha
FROM kardex_movimientos km
JOIN herramientas h ON km.herramienta_id = h.id
LEFT JOIN trabajadores t ON km.trabajador_id = t.id
LEFT JOIN ubicaciones u ON km.ubicacion_id = u.id
GROUP BY km.herramienta_id, km.trabajador_id, km.ubicacion_id, h.nombre, h.codigo_referencia, h.num_serial, t.nombre, u.nombre_obra
HAVING CAST(SUM(CASE WHEN km.tipo_movimiento = 'SALIDA' THEN km.cantidad ELSE 0 END) -
         SUM(CASE WHEN km.tipo_movimiento = 'DEVOLUCION' THEN km.cantidad ELSE 0 END) AS INTEGER) > 0;

-- 4. Función RPC: get_dashboard_stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_daily_movements INTEGER;
    v_active_loans INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_daily_movements 
    FROM kardex_movimientos 
    WHERE date(fecha AT TIME ZONE 'America/Bogota') = date(current_timestamp AT TIME ZONE 'America/Bogota');

    SELECT COALESCE(CAST(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN cantidad ELSE 0 END) -
                SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END) AS INTEGER), 0)
    INTO v_active_loans
    FROM kardex_movimientos;

    RETURN json_build_object(
        'dailyMovements', v_daily_movements,
        'activeLoans', v_active_loans
    );
END;
$$;
