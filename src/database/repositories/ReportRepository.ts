/**
 * ============================================================================
 * REPOSITORIO DE REPORTES Y VALORIZACIÓN DE INVENTARIO (KARDEX V2)
 * ============================================================================
 * 
 * Principios aplicados:
 * - SOLID:
 *   - S (Single Responsibility): Responsabilidad única de consolidar, calcular
 *     y entregar métricas financieras y de ubicación de inventario.
 *   - O (Open/Closed): Fácilmente extensible para nuevos tipos de reportes
 *     sin modificar la lógica existente.
 *   - L (Liskov Substitution): Implementaciones intercambiables (SQLite y Supabase).
 *   - I (Interface Segregation): Interfaces precisas y desacopladas.
 *   - D (Dependency Inversion): Las vistas consumen la interfaz IReportRepository.
 * 
 * - DRY (Don't Repeat Yourself):
 *   - Centralización del cálculo de valoración (cantidad * precio unitario)
 *     y agrupaciones por proyecto y categoría.
 * 
 * Para desarrolladores Junior:
 * En este sistema Kardex los activos pueden encontrarse en 3 estados/sitios:
 * 1. BODEGA CENTRAL: Activos disponibles físicamente en la bodega principal.
 * 2. PROYECTO / OBRA: Activos despachados (SALIDA) a un proyecto específico
 *    que aún no han sido devueltos (balance = SALIDA - DEVOLUCION > 0).
 * 3. MANTENIMIENTO: Activos actualmente en reparación o taller externo.
 * 
 * La valorización monetaria de cualquier grupo de activos se calcula como:
 * Subtotal = Cantidad * Precio_Unitario_COP
 */

import * as SQLite from 'expo-sqlite';
import { supabase } from '../../lib/supabase';
import { Category, Location } from './MovementRepository';

// ============================================================================
// MODELOS E INTERFACES DE DATOS (DATA CONTRACTS)
// ============================================================================

/**
 * Representa un ítem individual de inventario situado en una ubicación específica,
 * con su valor unitario y subtotal económico.
 */
export interface ReportInventoryItem {
  id: string;
  tool_id: string;
  tool_nombre: string;
  tool_codigo: string;
  tool_serial?: string | null;
  tool_marca?: string | null;
  categoria_id?: string | null;
  categoria_nombre: string;
  categoria_codigo: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  colaborador_id?: string | null;
  colaborador_nombre?: string | null;
  tipo_sitio: 'BODEGA' | 'PROYECTO' | 'MANTENIMIENTO';
  cantidad: number;
  precio_unitario: number;
  subtotal: number; // cantidad * precio_unitario
}

/**
 * Desglose por categoría dentro de una ubicación o proyecto específico.
 */
export interface CategoryBreakdown {
  categoria_id: string;
  categoria_nombre: string;
  categoria_codigo: string;
  unidades: number;
  valor: number;
}

/**
 * Resumen consolidado de valoración para un proyecto o ubicación configurada.
 */
export interface LocationValuationSummary {
  ubicacion_id: string;
  ubicacion_nombre: string;
  tipo_sitio: 'BODEGA' | 'PROYECTO' | 'MANTENIMIENTO';
  total_items: number;       // Cantidad de referencias distintas
  total_unidades: number;    // Suma física de unidades
  valor_total: number;       // Valor total en dinero ($ COP) en este proyecto
  desglose_categorias: CategoryBreakdown[]; // Cuánto dinero hay por cada categoría en este sitio
}

/**
 * Resumen consolidado de valoración por categoría general (Herramientas, Insumos, Equipos, etc.).
 */
export interface CategoryValuationSummary {
  categoria_id: string;
  categoria_nombre: string;
  categoria_codigo: string;
  total_items: number;
  total_unidades: number;
  valor_total: number;
  porcentaje_valor: number;  // Porcentaje representativo del total de activos (%)
}

/**
 * Reporte General Ejecutivo de toda la empresa.
 */
export interface GeneralValuationReport {
  // Gran Total de Activos
  gran_total_valor: number;
  gran_total_unidades: number;
  gran_total_referencias: number;

  // Valor distribuido por tipo de sitio
  valor_en_bodega: number;
  unidades_en_bodega: number;

  valor_en_proyectos: number;
  unidades_en_proyectos: number;

  valor_en_mantenimiento: number;
  unidades_en_mantenimiento: number;

  // Listas consolidadas
  por_ubicacion: LocationValuationSummary[];
  por_categoria: CategoryValuationSummary[];
}

/**
 * Filtros interactivos para consultar el reporte detallado.
 */
export interface ReportFilterOptions {
  ubicacionId?: string;      // ID de la obra o 'BODEGA' o 'MANTENIMIENTO'
  categoriaId?: string;      // ID de la categoría (Herramientas, Insumos, etc.)
  search?: string;           // Texto libre (nombre, código o serial)
  tipo_sitio?: 'TODOS' | 'BODEGA' | 'PROYECTO' | 'MANTENIMIENTO';
}

/**
 * Contrato de la interfaz que deben implementar tanto SQLite como Supabase.
 */
export interface IReportRepository {
  /**
   * Obtiene el consolidado ejecutivo global (totales de la empresa, por proyecto y por categoría).
   */
  getGeneralValuationReport(): Promise<GeneralValuationReport>;

  /**
   * Obtiene la lista discriminada de activos según los filtros seleccionados.
   */
  getDetailedInventoryReport(filters?: ReportFilterOptions): Promise<ReportInventoryItem[]>;

  /**
   * Obtiene todas las ubicaciones/proyectos configurados (incluyendo Bodega Central).
   */
  getAllLocations(): Promise<Location[]>;

  /**
   * Obtiene todas las categorías configuradas.
   */
  getAllCategories(): Promise<Category[]>;
}

// ============================================================================
// IMPLEMENTACIÓN EN SQLITE (OFFLINE-FIRST / LOCAL)
// ============================================================================

export class SQLiteReportRepository implements IReportRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  /**
   * Obtiene todas las ubicaciones registradas, asegurando que la Bodega Central esté incluida primero.
   */
  async getAllLocations(): Promise<Location[]> {
    return await this.db.getAllAsync<Location>(
      "SELECT id, nombre_obra, estado FROM ubicaciones ORDER BY (CASE WHEN UPPER(nombre_obra) LIKE '%BODEGA%' THEN 0 ELSE 1 END), nombre_obra ASC"
    );
  }

  /**
   * Obtiene todas las categorías del maestro.
   */
  async getAllCategories(): Promise<Category[]> {
    return await this.db.getAllAsync<Category>(
      'SELECT id, codigo, nombre, descripcion FROM categorias ORDER BY nombre ASC'
    );
  }

  /**
   * Consulta integral de todos los activos en sus ubicaciones físicas actuales.
   * Utiliza la lógica estricta del Kardex:
   * 1. Bodega: ENTRADA + DEVOLUCION + AJUSTE - SALIDA - MANTENIMIENTO
   * 2. Proyectos / Obras: SALIDA - DEVOLUCION agrupado por ubicación y trabajador
   * 3. Mantenimiento: MANTENIMIENTO pendiente
   */
  async getDetailedInventoryReport(filters?: ReportFilterOptions): Promise<ReportInventoryItem[]> {
    const items: ReportInventoryItem[] = [];

    // Localizar información de Bodega Central de manera segura
    let bodegaId = '00000000-0000-0000-0000-000000000002';
    let bodegaNombre = 'BODEGA';
    try {
      const bodegaLoc = await this.db.getFirstAsync<{ id: string; nombre_obra: string }>(
        "SELECT id, nombre_obra FROM ubicaciones WHERE UPPER(nombre_obra) LIKE '%BODEGA%' LIMIT 1"
      );
      if (bodegaLoc) {
        bodegaId = bodegaLoc.id;
        bodegaNombre = bodegaLoc.nombre_obra;
      }
    } catch (err) {
      console.warn('Advertencia obteniendo bodega en SQLite:', err);
    }

    // 1. OBTENER ITEMS EN BODEGA CENTRAL
    const bodegaQuery = `
      SELECT 
        h.id as tool_id,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        h.marca as tool_marca,
        h.categoria_id,
        COALESCE(c.nombre, 'Sin Categoría') as categoria_nombre,
        COALESCE(c.codigo, 'OTRO') as categoria_codigo,
        COALESCE(h.precio, 0) as precio_unitario,
        (
          COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION', 'AJUSTE') THEN km.cantidad ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('SALIDA', 'MANTENIMIENTO') THEN km.cantidad ELSE 0 END), 0)
        ) as cantidad
      FROM herramientas h
      LEFT JOIN categorias c ON h.categoria_id = c.id
      LEFT JOIN kardex_movimientos km ON h.id = km.herramienta_id
      GROUP BY h.id
      HAVING cantidad > 0
    `;

    try {
      const bodegaItems = await this.db.getAllAsync<any>(bodegaQuery);
      bodegaItems.forEach(r => {
        const qty = Number(r.cantidad || 0);
        const price = Number(r.precio_unitario || 0);
        items.push({
          id: `bodega_${r.tool_id}`,
          tool_id: r.tool_id,
          tool_nombre: r.tool_nombre,
          tool_codigo: r.tool_codigo,
          tool_serial: r.tool_serial,
          tool_marca: r.tool_marca,
          categoria_id: r.categoria_id,
          categoria_nombre: r.categoria_nombre,
          categoria_codigo: r.categoria_codigo,
          ubicacion_id: bodegaId,
          ubicacion_nombre: bodegaNombre,
          colaborador_id: null,
          colaborador_nombre: 'ALMACÉN CENTRAL',
          tipo_sitio: 'BODEGA',
          cantidad: qty,
          precio_unitario: price,
          subtotal: qty * price
        });
      });
    } catch (e) {
      console.warn('Error consultando items en bodega:', e);
    }

    // 2. OBTENER ITEMS ASIGNADOS EN PROYECTOS / OBRAS
    const projectQuery = `
      SELECT 
        h.id as tool_id,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        h.marca as tool_marca,
        h.categoria_id,
        COALESCE(c.nombre, 'Sin Categoría') as categoria_nombre,
        COALESCE(c.codigo, 'OTRO') as categoria_codigo,
        COALESCE(h.precio, 0) as precio_unitario,
        u.id as ubicacion_id,
        u.nombre_obra as ubicacion_nombre,
        t.id as colaborador_id,
        t.nombre as colaborador_nombre,
        'PROYECTO' as tipo_sitio,
        CAST(
          SUM(CASE WHEN km.tipo_movimiento = 'SALIDA' THEN km.cantidad ELSE 0 END) -
          SUM(CASE WHEN km.tipo_movimiento = 'DEVOLUCION' THEN km.cantidad ELSE 0 END)
        AS INTEGER) as cantidad
      FROM kardex_movimientos km
      JOIN herramientas h ON km.herramienta_id = h.id
      LEFT JOIN categorias c ON h.categoria_id = c.id
      JOIN ubicaciones u ON km.ubicacion_id = u.id
      LEFT JOIN trabajadores t ON km.trabajador_id = t.id
      WHERE UPPER(u.nombre_obra) NOT LIKE '%BODEGA%'
      GROUP BY h.id, km.ubicacion_id, COALESCE(km.trabajador_id, 'NULL')
      HAVING cantidad > 0
    `;

    try {
      const projectItems = await this.db.getAllAsync<any>(projectQuery);
      projectItems.forEach(r => {
        const qty = Number(r.cantidad || 0);
        const price = Number(r.precio_unitario || 0);
        items.push({
          id: `proj_${r.tool_id}_${r.ubicacion_id}_${r.colaborador_id || 'none'}`,
          tool_id: r.tool_id,
          tool_nombre: r.tool_nombre,
          tool_codigo: r.tool_codigo,
          tool_serial: r.tool_serial,
          tool_marca: r.tool_marca,
          categoria_id: r.categoria_id,
          categoria_nombre: r.categoria_nombre,
          categoria_codigo: r.categoria_codigo,
          ubicacion_id: r.ubicacion_id,
          ubicacion_nombre: r.ubicacion_nombre,
          colaborador_id: r.colaborador_id,
          colaborador_nombre: r.colaborador_nombre || 'Sin Responsable Asignado',
          tipo_sitio: 'PROYECTO',
          cantidad: qty,
          precio_unitario: price,
          subtotal: qty * price
        });
      });
    } catch (e) {
      console.warn('Error consultando items en proyectos:', e);
    }

    // 3. OBTENER ITEMS EN MANTENIMIENTO / TALLER
    const maintenanceQuery = `
      SELECT 
        h.id as tool_id,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        h.marca as tool_marca,
        h.categoria_id,
        COALESCE(c.nombre, 'Sin Categoría') as categoria_nombre,
        COALESCE(c.codigo, 'OTRO') as categoria_codigo,
        COALESCE(h.precio, 0) as precio_unitario,
        'mantenimiento-sitio' as ubicacion_id,
        'TALLER / MANTENIMIENTO' as ubicacion_nombre,
        NULL as colaborador_id,
        'EN REPARACIÓN' as colaborador_nombre,
        'MANTENIMIENTO' as tipo_sitio,
        CAST(SUM(km.cantidad) AS INTEGER) as cantidad
      FROM kardex_movimientos km
      JOIN herramientas h ON km.herramienta_id = h.id
      LEFT JOIN categorias c ON h.categoria_id = c.id
      WHERE km.tipo_movimiento = 'MANTENIMIENTO'
      GROUP BY h.id
      HAVING cantidad > 0
    `;

    try {
      const maintItems = await this.db.getAllAsync<any>(maintenanceQuery);
      maintItems.forEach(r => {
        const qty = Number(r.cantidad || 0);
        const price = Number(r.precio_unitario || 0);
        items.push({
          id: `maint_${r.tool_id}`,
          tool_id: r.tool_id,
          tool_nombre: r.tool_nombre,
          tool_codigo: r.tool_codigo,
          tool_serial: r.tool_serial,
          tool_marca: r.tool_marca,
          categoria_id: r.categoria_id,
          categoria_nombre: r.categoria_nombre,
          categoria_codigo: r.categoria_codigo,
          ubicacion_id: r.ubicacion_id,
          ubicacion_nombre: r.ubicacion_nombre,
          colaborador_id: null,
          colaborador_nombre: 'EN REPARACIÓN',
          tipo_sitio: 'MANTENIMIENTO',
          cantidad: qty,
          precio_unitario: price,
          subtotal: qty * price
        });
      });
    } catch (e) {
      console.warn('Error consultando items en mantenimiento:', e);
    }

    // APLICAR FILTROS EN MEMORIA PARA MÁXIMA VELOCIDAD Y CONSISTENCIA
    let filtered = items;

    if (filters?.tipo_sitio && filters.tipo_sitio !== 'TODOS') {
      filtered = filtered.filter(i => i.tipo_sitio === filters.tipo_sitio);
    }

    if (filters?.ubicacionId) {
      filtered = filtered.filter(i => i.ubicacion_id === filters.ubicacionId);
    }

    if (filters?.categoriaId) {
      filtered = filtered.filter(i => i.categoria_id === filters.categoriaId);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(i =>
        i.tool_nombre.toLowerCase().includes(q) ||
        i.tool_codigo.toLowerCase().includes(q) ||
        (i.tool_serial && i.tool_serial.toLowerCase().includes(q)) ||
        (i.tool_marca && i.tool_marca.toLowerCase().includes(q)) ||
        (i.colaborador_nombre && i.colaborador_nombre.toLowerCase().includes(q))
      );
    }

    return filtered;
  }

  /**
   * Genera el consolidado ejecutivo global con KPIs financieros y desgloses.
   */
  async getGeneralValuationReport(): Promise<GeneralValuationReport> {
    // Obtenemos todos los activos situados en el sistema
    const allItems = await this.getDetailedInventoryReport();

    let granTotalValor = 0;
    let granTotalUnidades = 0;
    const uniqueToolIds = new Set<string>();

    let valorBodega = 0;
    let unidadesBodega = 0;

    let valorProyectos = 0;
    let unidadesProyectos = 0;

    let valorMantenimiento = 0;
    let unidadesMantenimiento = 0;

    // Agrupadores auxiliares
    const locMap = new Map<string, {
      ubicacion_id: string;
      ubicacion_nombre: string;
      tipo_sitio: 'BODEGA' | 'PROYECTO' | 'MANTENIMIENTO';
      total_items: Set<string>;
      total_unidades: number;
      valor_total: number;
      catMap: Map<string, { categoria_id: string; categoria_nombre: string; categoria_codigo: string; unidades: number; valor: number }>;
    }>();

    const catMap = new Map<string, {
      categoria_id: string;
      categoria_nombre: string;
      categoria_codigo: string;
      total_items: Set<string>;
      total_unidades: number;
      valor_total: number;
    }>();

    for (const item of allItems) {
      granTotalValor += item.subtotal;
      granTotalUnidades += item.cantidad;
      uniqueToolIds.add(item.tool_id);

      // Clasificación por tipo de sitio
      if (item.tipo_sitio === 'BODEGA') {
        valorBodega += item.subtotal;
        unidadesBodega += item.cantidad;
      } else if (item.tipo_sitio === 'PROYECTO') {
        valorProyectos += item.subtotal;
        unidadesProyectos += item.cantidad;
      } else if (item.tipo_sitio === 'MANTENIMIENTO') {
        valorMantenimiento += item.subtotal;
        unidadesMantenimiento += item.cantidad;
      }

      // Agrupar por Ubicación / Proyecto
      let locSummary = locMap.get(item.ubicacion_id);
      if (!locSummary) {
        locSummary = {
          ubicacion_id: item.ubicacion_id,
          ubicacion_nombre: item.ubicacion_nombre,
          tipo_sitio: item.tipo_sitio,
          total_items: new Set<string>(),
          total_unidades: 0,
          valor_total: 0,
          catMap: new Map()
        };
        locMap.set(item.ubicacion_id, locSummary);
      }
      locSummary.total_items.add(item.tool_id);
      locSummary.total_unidades += item.cantidad;
      locSummary.valor_total += item.subtotal;

      // Desglose por categoría dentro de este sitio
      const catKey = item.categoria_id || 'sin_cat';
      let locCat = locSummary.catMap.get(catKey);
      if (!locCat) {
        locCat = {
          categoria_id: item.categoria_id || '',
          categoria_nombre: item.categoria_nombre,
          categoria_codigo: item.categoria_codigo,
          unidades: 0,
          valor: 0
        };
        locSummary.catMap.set(catKey, locCat);
      }
      locCat.unidades += item.cantidad;
      locCat.valor += item.subtotal;

      // Agrupar por Categoría global
      let globalCat = catMap.get(catKey);
      if (!globalCat) {
        globalCat = {
          categoria_id: item.categoria_id || '',
          categoria_nombre: item.categoria_nombre,
          categoria_codigo: item.categoria_codigo,
          total_items: new Set<string>(),
          total_unidades: 0,
          valor_total: 0
        };
        catMap.set(catKey, globalCat);
      }
      globalCat.total_items.add(item.tool_id);
      globalCat.total_unidades += item.cantidad;
      globalCat.valor_total += item.subtotal;
    }

    // Convertir mapas a listas ordenadas
    const porUbicacion: LocationValuationSummary[] = Array.from(locMap.values())
      .map(l => ({
        ubicacion_id: l.ubicacion_id,
        ubicacion_nombre: l.ubicacion_nombre,
        tipo_sitio: l.tipo_sitio,
        total_items: l.total_items.size,
        total_unidades: l.total_unidades,
        valor_total: l.valor_total,
        desglose_categorias: Array.from(l.catMap.values()).sort((a, b) => b.valor - a.valor)
      }))
      .sort((a, b) => {
        // Bodega siempre primero, luego por valor descendente
        if (a.tipo_sitio === 'BODEGA') return -1;
        if (b.tipo_sitio === 'BODEGA') return 1;
        return b.valor_total - a.valor_total;
      });

    const porCategoria: CategoryValuationSummary[] = Array.from(catMap.values())
      .map(c => ({
        categoria_id: c.categoria_id,
        categoria_nombre: c.categoria_nombre,
        categoria_codigo: c.categoria_codigo,
        total_items: c.total_items.size,
        total_unidades: c.total_unidades,
        valor_total: c.valor_total,
        porcentaje_valor: granTotalValor > 0 ? (c.valor_total / granTotalValor) * 100 : 0
      }))
      .sort((a, b) => b.valor_total - a.valor_total);

    return {
      gran_total_valor: granTotalValor,
      gran_total_unidades: granTotalUnidades,
      gran_total_referencias: uniqueToolIds.size,
      valor_en_bodega: valorBodega,
      unidades_en_bodega: unidadesBodega,
      valor_en_proyectos: valorProyectos,
      unidades_en_proyectos: unidadesProyectos,
      valor_en_mantenimiento: valorMantenimiento,
      unidades_en_mantenimiento: unidadesMantenimiento,
      por_ubicacion: porUbicacion,
      por_categoria: porCategoria
    };
  }
}

// ============================================================================
// IMPLEMENTACIÓN EN SUPABASE (ONLINE / CLOUD)
// ============================================================================

export class SupabaseReportRepository implements IReportRepository {
  async getAllLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('ubicaciones')
      .select('id, nombre_obra, estado')
      .order('nombre_obra', { ascending: true });
    if (error) throw error;
    return (data || []).sort((a, b) => {
      if (a.nombre_obra.toUpperCase().includes('BODEGA')) return -1;
      if (b.nombre_obra.toUpperCase().includes('BODEGA')) return 1;
      return a.nombre_obra.localeCompare(b.nombre_obra);
    });
  }

  async getAllCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, codigo, nombre, descripcion')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getDetailedInventoryReport(filters?: ReportFilterOptions): Promise<ReportInventoryItem[]> {
    const items: ReportInventoryItem[] = [];

    // 1. Obtener todas las herramientas con su precio y categoría
    const { data: toolsData, error: toolsError } = await supabase
      .from('herramientas')
      .select('id, nombre, marca, codigo_referencia, num_serial, precio, categoria_id, categorias(id, codigo, nombre)');

    if (toolsError) throw toolsError;

    const toolMap = new Map<string, any>();
    toolsData?.forEach(t => toolMap.set(t.id, t));

    // 2. Bodega via view_tools_with_stock
    const { data: stockData, error: stockError } = await supabase
      .from('view_tools_with_stock')
      .select('*');

    if (!stockError && stockData) {
      // Localizar id de bodega
      const { data: bodegaLoc } = await supabase
        .from('ubicaciones')
        .select('id, nombre_obra')
        .ilike('nombre_obra', '%BODEGA%')
        .limit(1)
        .maybeSingle();

      const bodegaId = bodegaLoc?.id || '00000000-0000-0000-0000-000000000002';
      const bodegaNombre = bodegaLoc?.nombre_obra || 'BODEGA PRINCIPAL';

      stockData.forEach((s: any) => {
        const qty = Number(s.stock_total || 0);
        if (qty > 0) {
          const tool = toolMap.get(s.id);
          const price = Number(tool?.precio || 0);
          items.push({
            id: `bodega_${s.id}`,
            tool_id: s.id,
            tool_nombre: s.nombre,
            tool_codigo: s.codigo_referencia,
            tool_serial: s.num_serial,
            tool_marca: s.marca,
            categoria_id: tool?.categoria_id,
            categoria_nombre: tool?.categorias?.nombre || 'Sin Categoría',
            categoria_codigo: tool?.categorias?.codigo || 'OTRO',
            ubicacion_id: bodegaId,
            ubicacion_nombre: bodegaNombre,
            colaborador_id: null,
            colaborador_nombre: 'ALMACÉN CENTRAL',
            tipo_sitio: 'BODEGA',
            cantidad: qty,
            precio_unitario: price,
            subtotal: qty * price
          });
        }
      });
    }

    // 3. Proyectos via view_assigned_tools
    const { data: assignedData, error: assignedError } = await supabase
      .from('view_assigned_tools')
      .select('*');

    if (!assignedError && assignedData) {
      assignedData.forEach((a: any) => {
        const qty = Number(a.balance || 0);
        if (qty > 0) {
          const tool = toolMap.get(a.herramienta_id);
          const price = Number(tool?.precio || 0);
          items.push({
            id: `proj_${a.id}`,
            tool_id: a.herramienta_id,
            tool_nombre: a.tool_nombre,
            tool_codigo: a.tool_codigo,
            tool_serial: a.tool_serial,
            tool_marca: tool?.marca,
            categoria_id: tool?.categoria_id,
            categoria_nombre: tool?.categorias?.nombre || 'Sin Categoría',
            categoria_codigo: tool?.categorias?.codigo || 'OTRO',
            ubicacion_id: a.ubicacion_id,
            ubicacion_nombre: a.location_nombre || 'Proyecto Asignado',
            colaborador_id: a.trabajador_id,
            colaborador_nombre: a.collaborator_nombre || 'Sin Responsable Asignado',
            tipo_sitio: 'PROYECTO',
            cantidad: qty,
            precio_unitario: price,
            subtotal: qty * price
          });
        }
      });
    }

    // 4. Mantenimiento via view_tools_in_maintenance
    const { data: maintData, error: maintError } = await supabase
      .from('view_tools_in_maintenance')
      .select('*');

    if (!maintError && maintData) {
      maintData.forEach((m: any) => {
        const qty = Number(m.balance || 0);
        if (qty > 0) {
          const tool = toolMap.get(m.herramienta_id);
          const price = Number(tool?.precio || 0);
          items.push({
            id: `maint_${m.herramienta_id}`,
            tool_id: m.herramienta_id,
            tool_nombre: m.tool_nombre,
            tool_codigo: m.tool_codigo,
            tool_serial: m.tool_serial,
            tool_marca: tool?.marca,
            categoria_id: tool?.categoria_id,
            categoria_nombre: tool?.categorias?.nombre || 'Sin Categoría',
            categoria_codigo: tool?.categorias?.codigo || 'OTRO',
            ubicacion_id: 'mantenimiento-sitio',
            ubicacion_nombre: 'TALLER / MANTENIMIENTO',
            colaborador_id: null,
            colaborador_nombre: 'EN REPARACIÓN',
            tipo_sitio: 'MANTENIMIENTO',
            cantidad: qty,
            precio_unitario: price,
            subtotal: qty * price
          });
        }
      });
    }

    // Filtros
    let filtered = items;
    if (filters?.tipo_sitio && filters.tipo_sitio !== 'TODOS') {
      filtered = filtered.filter(i => i.tipo_sitio === filters.tipo_sitio);
    }
    if (filters?.ubicacionId) {
      filtered = filtered.filter(i => i.ubicacion_id === filters.ubicacionId);
    }
    if (filters?.categoriaId) {
      filtered = filtered.filter(i => i.categoria_id === filters.categoriaId);
    }
    if (filters?.search && filters.search.trim().length > 0) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(i =>
        i.tool_nombre.toLowerCase().includes(q) ||
        i.tool_codigo.toLowerCase().includes(q) ||
        (i.tool_serial && i.tool_serial.toLowerCase().includes(q)) ||
        (i.tool_marca && i.tool_marca.toLowerCase().includes(q)) ||
        (i.colaborador_nombre && i.colaborador_nombre.toLowerCase().includes(q))
      );
    }

    return filtered;
  }

  async getGeneralValuationReport(): Promise<GeneralValuationReport> {
    const allItems = await this.getDetailedInventoryReport();

    let granTotalValor = 0;
    let granTotalUnidades = 0;
    const uniqueToolIds = new Set<string>();

    let valorBodega = 0;
    let unidadesBodega = 0;

    let valorProyectos = 0;
    let unidadesProyectos = 0;

    let valorMantenimiento = 0;
    let unidadesMantenimiento = 0;

    const locMap = new Map<string, {
      ubicacion_id: string;
      ubicacion_nombre: string;
      tipo_sitio: 'BODEGA' | 'PROYECTO' | 'MANTENIMIENTO';
      total_items: Set<string>;
      total_unidades: number;
      valor_total: number;
      catMap: Map<string, { categoria_id: string; categoria_nombre: string; categoria_codigo: string; unidades: number; valor: number }>;
    }>();

    const catMap = new Map<string, {
      categoria_id: string;
      categoria_nombre: string;
      categoria_codigo: string;
      total_items: Set<string>;
      total_unidades: number;
      valor_total: number;
    }>();

    for (const item of allItems) {
      granTotalValor += item.subtotal;
      granTotalUnidades += item.cantidad;
      uniqueToolIds.add(item.tool_id);

      if (item.tipo_sitio === 'BODEGA') {
        valorBodega += item.subtotal;
        unidadesBodega += item.cantidad;
      } else if (item.tipo_sitio === 'PROYECTO') {
        valorProyectos += item.subtotal;
        unidadesProyectos += item.cantidad;
      } else if (item.tipo_sitio === 'MANTENIMIENTO') {
        valorMantenimiento += item.subtotal;
        unidadesMantenimiento += item.cantidad;
      }

      let locSummary = locMap.get(item.ubicacion_id);
      if (!locSummary) {
        locSummary = {
          ubicacion_id: item.ubicacion_id,
          ubicacion_nombre: item.ubicacion_nombre,
          tipo_sitio: item.tipo_sitio,
          total_items: new Set<string>(),
          total_unidades: 0,
          valor_total: 0,
          catMap: new Map()
        };
        locMap.set(item.ubicacion_id, locSummary);
      }
      locSummary.total_items.add(item.tool_id);
      locSummary.total_unidades += item.cantidad;
      locSummary.valor_total += item.subtotal;

      const catKey = item.categoria_id || 'sin_cat';
      let locCat = locSummary.catMap.get(catKey);
      if (!locCat) {
        locCat = {
          categoria_id: item.categoria_id || '',
          categoria_nombre: item.categoria_nombre,
          categoria_codigo: item.categoria_codigo,
          unidades: 0,
          valor: 0
        };
        locSummary.catMap.set(catKey, locCat);
      }
      locCat.unidades += item.cantidad;
      locCat.valor += item.subtotal;

      let globalCat = catMap.get(catKey);
      if (!globalCat) {
        globalCat = {
          categoria_id: item.categoria_id || '',
          categoria_nombre: item.categoria_nombre,
          categoria_codigo: item.categoria_codigo,
          total_items: new Set<string>(),
          total_unidades: 0,
          valor_total: 0
        };
        catMap.set(catKey, globalCat);
      }
      globalCat.total_items.add(item.tool_id);
      globalCat.total_unidades += item.cantidad;
      globalCat.valor_total += item.subtotal;
    }

    const porUbicacion: LocationValuationSummary[] = Array.from(locMap.values())
      .map(l => ({
        ubicacion_id: l.ubicacion_id,
        ubicacion_nombre: l.ubicacion_nombre,
        tipo_sitio: l.tipo_sitio,
        total_items: l.total_items.size,
        total_unidades: l.total_unidades,
        valor_total: l.valor_total,
        desglose_categorias: Array.from(l.catMap.values()).sort((a, b) => b.valor - a.valor)
      }))
      .sort((a, b) => {
        if (a.tipo_sitio === 'BODEGA') return -1;
        if (b.tipo_sitio === 'BODEGA') return 1;
        return b.valor_total - a.valor_total;
      });

    const porCategoria: CategoryValuationSummary[] = Array.from(catMap.values())
      .map(c => ({
        categoria_id: c.categoria_id,
        categoria_nombre: c.categoria_nombre,
        categoria_codigo: c.categoria_codigo,
        total_items: c.total_items.size,
        total_unidades: c.total_unidades,
        valor_total: c.valor_total,
        porcentaje_valor: granTotalValor > 0 ? (c.valor_total / granTotalValor) * 100 : 0
      }))
      .sort((a, b) => b.valor_total - a.valor_total);

    return {
      gran_total_valor: granTotalValor,
      gran_total_unidades: granTotalUnidades,
      gran_total_referencias: uniqueToolIds.size,
      valor_en_bodega: valorBodega,
      unidades_en_bodega: unidadesBodega,
      valor_en_proyectos: valorProyectos,
      unidades_en_proyectos: unidadesProyectos,
      valor_en_mantenimiento: valorMantenimiento,
      unidades_en_mantenimiento: unidadesMantenimiento,
      por_ubicacion: porUbicacion,
      por_categoria: porCategoria
    };
  }
}

// ============================================================================
// FACTORY PATTERN (PATRÓN DE FABRICACIÓN)
// ============================================================================

/**
 * Función fábrica para obtener la instancia adecuada del repositorio
 * según el estado de conectividad (Online/Offline).
 * Aplica el principio de Inversión de Dependencias (DIP).
 */
export const getReportRepository = async (isOnline: boolean = false): Promise<IReportRepository> => {
  if (isOnline) {
    try {
      const repo = new SupabaseReportRepository();
      // Verificación rápida de disponibilidad
      await repo.getAllCategories();
      return repo;
    } catch (e) {
      console.warn('Fallback a SQLite para Reportes por fallo en Supabase:', e);
    }
  }

  const db = await SQLite.openDatabaseAsync('kardex.db');
  return new SQLiteReportRepository(db);
};
