import * as SQLite from 'expo-sqlite';
import { supabase } from '../../lib/supabase';

export interface Category {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
}

export interface Tool {
  id: string;
  nombre: string;
  marca?: string;
  descripcion?: string;
  codigo_referencia: string;
  num_serial?: string;
  fecha_compra?: string;
  estanteria?: string;
  categoria_id?: string;
  categoria_nombre?: string;
  categoria_codigo?: string;
  precio?: number;
}

export interface ToolWithStock extends Tool {
  stock_bueno: number;
  stock_malo: number;
  stock_total: number;
}

export interface Collaborator {
  id: string;
  cedula: string;
  nombre: string;
  cargo: string;
}

export interface Location {
  id: string;
  nombre_obra: string;
  estado: string;
}

export interface BusinessLine {
  id: string;
  codigo: string;
  nombre: string;
}

export interface Movement {
  id: string;
  herramienta_id: string;
  trabajador_id?: string; // This maps to the collaborator in the UI
  ubicacion_id?: string;
  linea_negocio_id?: string;
  tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'DEVOLUCION' | 'MANTENIMIENTO' | 'AJUSTE';
  cantidad: number;
  estado_insumo: 'BUENA' | 'MALA';
  observaciones?: string;
  fecha?: string;
  usuario_sistema_id: string;
}

export interface MovementListItem extends Movement {
  tool_nombre: string;
  tool_codigo: string;
  tool_serial?: string;
  tool_marca?: string; // Marca de la herramienta/insumo
  tool_categoria_codigo?: string; // Código de categoría (HERRAMIENTAS, INSUMOS, EQUIPOS, etc.)
  collaborator_nombre?: string;
  location_nombre?: string;
  business_line_nombre?: string;
  balance: number; // Changed from cantidad (shadowing) to balance
}

export interface IMovementRepository {
  // Tools
  createTool(tool: Tool): Promise<void>;
  getAllTools(): Promise<Tool[]>;
  getToolsWithStock(): Promise<ToolWithStock[]>;
  updateTool(tool: Tool): Promise<void>;
  getToolByCode(code: string): Promise<Tool | null>;
  getToolByCodeAndSerial(code: string, serial: string | null): Promise<Tool | null>;
  getAssignedToolsByCode(code: string): Promise<MovementListItem[]>;
  /**
   * Obtiene artículos asignados (con balance > 0) filtrados por colaborador/ubicación.
   * @param categoryType 'tools' = solo HERRAMIENTAS | 'supplies' = todo excepto HERRAMIENTAS | 'all' = sin restricción
   */
  getAssignedToolsByFilter(collaboratorId?: string, locationId?: string, categoryType?: 'tools' | 'supplies' | 'all'): Promise<MovementListItem[]>;

  // Movements
  registerMovement(movement: Movement): Promise<void>;
  registerMovements(movements: Movement[]): Promise<void>;
  getBodegaId(): Promise<string>;
  getToolsInMaintenance(): Promise<MovementListItem[]>;
  getMovements(limit: number, offset: number, type?: string, startDate?: string, endDate?: string, collaboratorId?: string, locationId?: string, toolCode?: string, toolSerial?: string, businessLineId?: string): Promise<MovementListItem[]>;

  // Collaborators (formerly workers)
  createCollaborator(c: Collaborator): Promise<void>;
  getAllCollaborators(): Promise<Collaborator[]>;

  // Locations
  createLocation(l: Location): Promise<void>;
  getAllLocations(): Promise<Location[]>;

  // Business Lines
  createBusinessLine(bl: BusinessLine): Promise<void>;
  getAllBusinessLines(): Promise<BusinessLine[]>;

  // Categories (Maestro de Categorías: Herramientas, Insumos, Equipos, etc.)
  createCategory(c: Category): Promise<void>;
  getAllCategories(): Promise<Category[]>;
  updateCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  // Dashboard Stats
  getDashboardStats(): Promise<{ dailyMovements: number; activeLoans: number }>;

  // Lifecycle
  getToolLifeCycle(toolId: string): Promise<MovementListItem[]>;
}

export class SQLiteMovementRepository implements IMovementRepository {
  constructor(private db: SQLite.SQLiteDatabase) { }

  // Tools
  async createTool(tool: Tool): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO herramientas (id, nombre, marca, descripcion, codigo_referencia, num_serial, fecha_compra, estanteria, categoria_id, precio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        tool.id,
        tool.nombre,
        tool.marca || null,
        tool.descripcion || null,
        tool.codigo_referencia,
        tool.num_serial || null,
        tool.fecha_compra || null,
        tool.estanteria || null,
        tool.categoria_id || null,
        tool.precio ?? 0
      ]
    );
  }

  async getAllTools(): Promise<Tool[]> {
    return await this.db.getAllAsync<Tool>(`
      SELECT h.*, c.nombre as categoria_nombre, c.codigo as categoria_codigo
      FROM herramientas h
      LEFT JOIN categorias c ON h.categoria_id = c.id
      ORDER BY h.nombre ASC
    `);
  }

  async updateTool(tool: Tool): Promise<void> {
    await this.db.runAsync(
      'UPDATE herramientas SET nombre = ?, marca = ?, descripcion = ?, codigo_referencia = ?, num_serial = ?, fecha_compra = ?, estanteria = ?, categoria_id = ?, precio = ? WHERE id = ?',
      [
        tool.nombre,
        tool.marca || null,
        tool.descripcion || null,
        tool.codigo_referencia,
        tool.num_serial || null,
        tool.fecha_compra || null,
        tool.estanteria || null,
        tool.categoria_id || null,
        tool.precio ?? 0,
        tool.id
      ]
    );
  }

  async getToolsWithStock(): Promise<ToolWithStock[]> {
    const query = `
      SELECT 
        h.*,
        c.nombre as categoria_nombre,
        c.codigo as categoria_codigo,
        COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION', 'AJUSTE') AND COALESCE(km.estado_insumo, 'BUENA') = 'BUENA' THEN km.cantidad ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('SALIDA', 'MANTENIMIENTO') AND COALESCE(km.estado_insumo, 'BUENA') = 'BUENA' THEN km.cantidad ELSE 0 END), 0) as stock_bueno,
        COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION', 'AJUSTE') AND km.estado_insumo = 'MALA' THEN km.cantidad ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN km.tipo_movimiento IN ('SALIDA', 'MANTENIMIENTO') AND km.estado_insumo = 'MALA' THEN km.cantidad ELSE 0 END), 0) as stock_malo
      FROM herramientas h
      LEFT JOIN categorias c ON h.categoria_id = c.id
      LEFT JOIN kardex_movimientos km ON h.id = km.herramienta_id
      GROUP BY h.id
      ORDER BY h.nombre ASC
    `;
    const results = await this.db.getAllAsync<any>(query);
    return results.map(r => ({
      ...r,
      precio: Number(r.precio || 0),
      stock_bueno: Number(r.stock_bueno),
      stock_malo: Number(r.stock_malo),
      stock_total: Number(r.stock_bueno) + Number(r.stock_malo)
    }));
  }

  async getToolsInMaintenance(): Promise<MovementListItem[]> {
    const query = `
      SELECT 
        km.herramienta_id as id,
        km.herramienta_id,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        c.codigo as tool_categoria_codigo,
        CAST(SUM(km.cantidad) AS INTEGER) as balance,
        MAX(km.fecha) as fecha,
        MAX(km.observaciones) as observaciones
      FROM kardex_movimientos km
      JOIN herramientas h ON km.herramienta_id = h.id
      LEFT JOIN categorias c ON h.categoria_id = c.id
      WHERE km.tipo_movimiento = 'MANTENIMIENTO'
      GROUP BY km.herramienta_id
      HAVING balance > 0
      ORDER BY fecha DESC
    `;
    return await this.db.getAllAsync<MovementListItem>(query);
  }

  async getToolByCode(code: string): Promise<Tool | null> {
    // Look for tool with this code and NO serial (grouped version)
    return await this.db.getFirstAsync<Tool>(
      `SELECT h.*, c.nombre as categoria_nombre, c.codigo as categoria_codigo
       FROM herramientas h
       LEFT JOIN categorias c ON h.categoria_id = c.id
       WHERE h.codigo_referencia = ? AND (h.num_serial IS NULL OR h.num_serial = "")`,
      [code]
    );
  }

  async getToolByCodeAndSerial(code: string, serial: string | null): Promise<Tool | null> {
    if (!serial) return this.getToolByCode(code);
    return await this.db.getFirstAsync<Tool>(
      `SELECT h.*, c.nombre as categoria_nombre, c.codigo as categoria_codigo
       FROM herramientas h
       LEFT JOIN categorias c ON h.categoria_id = c.id
       WHERE h.codigo_referencia = ? AND h.num_serial = ?`,
      [code, serial]
    );
  }

  // Movements
  async registerMovement(m: Movement): Promise<void> {
    const query = `INSERT INTO kardex_movimientos (
        id, herramienta_id, trabajador_id, ubicacion_id, linea_negocio_id, tipo_movimiento, 
        cantidad, estado_insumo, observaciones, usuario_sistema_id, fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      m.id, m.herramienta_id, m.trabajador_id || null, m.ubicacion_id || null, m.linea_negocio_id || null,
      m.tipo_movimiento, m.cantidad, m.estado_insumo, m.observaciones || null, m.usuario_sistema_id,
      m.fecha || new Date().toISOString()
    ];
    await this.db.runAsync(query, params);
  }

  async registerMovements(movements: Movement[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const m of movements) {
        const query = `INSERT INTO kardex_movimientos (
            id, herramienta_id, trabajador_id, ubicacion_id, linea_negocio_id, tipo_movimiento, 
            cantidad, estado_insumo, observaciones, usuario_sistema_id, fecha
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          m.id, m.herramienta_id, m.trabajador_id || null, m.ubicacion_id || null, m.linea_negocio_id || null,
          m.tipo_movimiento, m.cantidad, m.estado_insumo, m.observaciones || null, m.usuario_sistema_id,
          m.fecha || new Date().toISOString()
        ];
        await this.db.runAsync(query, params);
      }
    });
  }

  async getBodegaId(): Promise<string> {
    const result = await this.db.getFirstAsync<{ id: string }>(
      "SELECT id FROM ubicaciones WHERE nombre_obra = 'BODEGA' LIMIT 1"
    );
    return result?.id || '00000000-0000-0000-0000-000000000002';
  }

  async getMovements(limit: number, offset: number, type?: string, startDate?: string, endDate?: string, collaboratorId?: string, locationId?: string, toolCode?: string, toolSerial?: string, businessLineId?: string): Promise<MovementListItem[]> {
    let query = `
      SELECT 
        km.*,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        h.marca as tool_marca,
        t.nombre as collaborator_nombre,
        u.nombre_obra as location_nombre,
        ln.nombre as business_line_nombre
      FROM kardex_movimientos km
      JOIN herramientas h ON km.herramienta_id = h.id
      LEFT JOIN trabajadores t ON km.trabajador_id = t.id
      LEFT JOIN ubicaciones u ON km.ubicacion_id = u.id
      LEFT JOIN lineas_negocio ln ON km.linea_negocio_id = ln.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (type) {
      query += ` AND km.tipo_movimiento = ?`;
      params.push(type);
    }

    if (startDate) {
      query += ` AND date(km.fecha) >= date(?)`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date(km.fecha) <= date(?)`;
      params.push(endDate);
    }

    if (collaboratorId) {
      query += ` AND km.trabajador_id = ?`;
      params.push(collaboratorId);
    }

    if (locationId) {
      query += ` AND km.ubicacion_id = ?`;
      params.push(locationId);
    }

    if (toolCode) {
      query += ` AND h.codigo_referencia LIKE ?`;
      params.push(`%${toolCode}%`);
    }

    if (toolSerial) {
      query += ` AND h.num_serial LIKE ?`;
      params.push(`%${toolSerial}%`);
    }

    query += ` ORDER BY km.fecha DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return await this.db.getAllAsync<MovementListItem>(query, params);
  }

  async getAssignedToolsByCode(code: string): Promise<MovementListItem[]> {
    // Aggregated balance per unique assignment group (Tool + Holder + Location)
    const query = `
      SELECT 
        (km.herramienta_id || '_' || COALESCE(km.trabajador_id, 'NULL') || '_' || COALESCE(km.ubicacion_id, 'NULL')) as id,
        km.herramienta_id,
        km.trabajador_id,
        km.ubicacion_id,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        h.marca as tool_marca,
        t.nombre as collaborator_nombre,
        u.nombre_obra as location_nombre,
        CAST(SUM(CASE WHEN km.tipo_movimiento = 'SALIDA' THEN km.cantidad ELSE 0 END) -
             SUM(CASE WHEN km.tipo_movimiento = 'DEVOLUCION' THEN km.cantidad ELSE 0 END) AS INTEGER) as balance,
        MAX(km.fecha) as fecha
      FROM kardex_movimientos km
      JOIN herramientas h ON km.herramienta_id = h.id
      LEFT JOIN trabajadores t ON km.trabajador_id = t.id
      LEFT JOIN ubicaciones u ON km.ubicacion_id = u.id
      WHERE h.codigo_referencia = ?
      GROUP BY km.herramienta_id, COALESCE(km.trabajador_id, 'NULL'), COALESCE(km.ubicacion_id, 'NULL')
      HAVING balance > 0
      ORDER BY tool_serial ASC
    `;
    return await this.db.getAllAsync<MovementListItem>(query, [code]);
  }

  async getAssignedToolsByFilter(
    collaboratorId?: string,
    locationId?: string,
    categoryType: 'tools' | 'supplies' | 'all' = 'all'
  ): Promise<MovementListItem[]> {
    if (!collaboratorId && !locationId) return [];

    let filterClause = '';
    const params: any[] = [];

    if (collaboratorId) {
      filterClause += ' AND km.trabajador_id = ?';
      params.push(collaboratorId);
    }

    if (locationId) {
      filterClause += ' AND km.ubicacion_id = ?';
      params.push(locationId);
    }

    // Filtro por tipo de categoría: HERRAMIENTAS vs el resto (Insumos, Equipos, etc.)
    if (categoryType === 'tools') {
      filterClause += " AND c.codigo = 'HERRAMIENTAS'";
    } else if (categoryType === 'supplies') {
      filterClause += " AND (c.codigo IS NULL OR c.codigo != 'HERRAMIENTAS')";
    }

    const query = `
      SELECT 
        (km.herramienta_id || '_' || COALESCE(km.trabajador_id, 'NULL') || '_' || COALESCE(km.ubicacion_id, 'NULL')) as id,
        km.herramienta_id,
        km.trabajador_id,
        km.ubicacion_id,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        h.marca as tool_marca,
        c.codigo as tool_categoria_codigo,
        t.nombre as collaborator_nombre,
        u.nombre_obra as location_nombre,
        CAST(SUM(CASE WHEN km.tipo_movimiento = 'SALIDA' THEN km.cantidad ELSE 0 END) -
             SUM(CASE WHEN km.tipo_movimiento = 'DEVOLUCION' THEN km.cantidad ELSE 0 END) AS INTEGER) as balance,
        MAX(km.fecha) as fecha
      FROM kardex_movimientos km
      JOIN herramientas h ON km.herramienta_id = h.id
      LEFT JOIN categorias c ON h.categoria_id = c.id
      LEFT JOIN trabajadores t ON km.trabajador_id = t.id
      LEFT JOIN ubicaciones u ON km.ubicacion_id = u.id
      WHERE 1=1 ${filterClause}
      GROUP BY km.herramienta_id, COALESCE(km.trabajador_id, 'NULL'), COALESCE(km.ubicacion_id, 'NULL')
      HAVING balance > 0
      ORDER BY fecha DESC
    `;
    return await this.db.getAllAsync<MovementListItem>(query, params);
  }

  // Collaborators
  async createCollaborator(c: Collaborator): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO trabajadores (id, cedula, nombre, cargo) VALUES (?, ?, ?, ?)',
      [c.id, c.cedula, c.nombre, c.cargo]
    );
  }

  async getAllCollaborators(): Promise<Collaborator[]> {
    return await this.db.getAllAsync<Collaborator>('SELECT * FROM trabajadores ORDER BY nombre ASC');
  }

  // Locations
  async createLocation(l: Location): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO ubicaciones (id, nombre_obra, estado) VALUES (?, ?, ?)',
      [l.id, l.nombre_obra, l.estado]
    );
  }

  async getAllLocations(): Promise<Location[]> {
    return await this.db.getAllAsync<Location>("SELECT * FROM ubicaciones WHERE nombre_obra != 'BODEGA' ORDER BY nombre_obra ASC");
  }

  // Business Lines
  async createBusinessLine(bl: BusinessLine): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO lineas_negocio (id, codigo, nombre) VALUES (?, ?, ?)',
      [bl.id, bl.codigo, bl.nombre]
    );
  }

  async getAllBusinessLines(): Promise<BusinessLine[]> {
    return await this.db.getAllAsync<BusinessLine>('SELECT * FROM lineas_negocio ORDER BY nombre ASC');
  }

  // Categories (Maestro)
  async createCategory(c: Category): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO categorias (id, codigo, nombre, descripcion) VALUES (?, ?, ?, ?)',
      [c.id, c.codigo, c.nombre, c.descripcion || null]
    );
  }

  async getAllCategories(): Promise<Category[]> {
    return await this.db.getAllAsync<Category>('SELECT * FROM categorias ORDER BY nombre ASC');
  }

  async updateCategory(c: Category): Promise<void> {
    await this.db.runAsync(
      'UPDATE categorias SET codigo = ?, nombre = ?, descripcion = ? WHERE id = ?',
      [c.codigo, c.nombre, c.descripcion || null, c.id]
    );
  }

  async deleteCategory(id: string): Promise<void> {
    const countResult = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM herramientas WHERE categoria_id = ?',
      [id]
    );
    if (countResult && countResult.count > 0) {
      throw new Error(`No se puede eliminar la categoría porque tiene ${countResult.count} artículo(s) asociado(s).`);
    }
    await this.db.runAsync('DELETE FROM categorias WHERE id = ?', [id]);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<{ dailyMovements: number; activeLoans: number }> {
    const dailyQuery = `SELECT COUNT(*) as count FROM kardex_movimientos WHERE date(fecha) = date('now', 'localtime')`;
    const activeLoansQuery = `
      SELECT CAST(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN cantidad ELSE 0 END) -
                  SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END) AS INTEGER) as count 
      FROM kardex_movimientos
    `;

    const dailyResult = await this.db.getFirstAsync<{ count: number }>(dailyQuery);
    const activeResult = await this.db.getFirstAsync<{ count: number }>(activeLoansQuery);

    return {
      dailyMovements: dailyResult?.count || 0,
      activeLoans: activeResult?.count || 0
    };
  }

  async getToolLifeCycle(toolId: string): Promise<MovementListItem[]> {
    const query = `
      SELECT 
        km.id,
        km.herramienta_id,
        km.trabajador_id,
        km.ubicacion_id,
        km.tipo_movimiento,
        km.cantidad,
        km.fecha,
        km.observaciones,
        km.estado_insumo,
        h.nombre as tool_nombre,
        h.codigo_referencia as tool_codigo,
        h.num_serial as tool_serial,
        h.marca as tool_marca,
        t.nombre as collaborator_nombre,
        u.nombre_obra as location_nombre,
        ln.nombre as business_line_nombre
      FROM kardex_movimientos km
      JOIN herramientas h ON km.herramienta_id = h.id
      LEFT JOIN trabajadores t ON km.trabajador_id = t.id
      LEFT JOIN ubicaciones u ON km.ubicacion_id = u.id
      LEFT JOIN lineas_negocio ln ON km.linea_negocio_id = ln.id
      WHERE km.herramienta_id = ?
      ORDER BY km.fecha DESC
    `;
    return await this.db.getAllAsync<MovementListItem>(query, [toolId]);
  }
}

export class SupabaseMovementRepository implements IMovementRepository {
  async createTool(tool: Tool): Promise<void> {
    const { error } = await supabase.from('herramientas').insert([{
      id: tool.id,
      nombre: tool.nombre,
      marca: tool.marca || null,
      descripcion: tool.descripcion || null,
      codigo_referencia: tool.codigo_referencia,
      num_serial: tool.num_serial || null,
      fecha_compra: tool.fecha_compra || null,
      estanteria: tool.estanteria || null,
      categoria_id: tool.categoria_id || null,
      precio: tool.precio ?? 0
    }]);
    if (error) throw error;
  }

  async getAllTools(): Promise<Tool[]> {
    const { data, error } = await supabase.from('herramientas').select('*, categorias(nombre, codigo)').order('nombre', { ascending: true });
    if (error) throw error;
    return (data || []).map((t: any) => ({
      ...t,
      categoria_nombre: t.categorias?.nombre,
      categoria_codigo: t.categorias?.codigo
    }));
  }

  async updateTool(tool: Tool): Promise<void> {
    const { error } = await supabase.from('herramientas').update({
      nombre: tool.nombre,
      marca: tool.marca || null,
      descripcion: tool.descripcion || null,
      codigo_referencia: tool.codigo_referencia,
      num_serial: tool.num_serial || null,
      fecha_compra: tool.fecha_compra || null,
      estanteria: tool.estanteria || null,
      categoria_id: tool.categoria_id || null,
      precio: tool.precio ?? 0
    }).eq('id', tool.id);
    if (error) throw error;
  }

  async getToolsWithStock(): Promise<ToolWithStock[]> {
    const { data, error } = await supabase.from('view_tools_with_stock').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    return data.map((r: any) => ({
      ...r,
      precio: Number(r.precio || 0),
      stock_bueno: Number(r.stock_bueno),
      stock_malo: Number(r.stock_malo),
      stock_total: Number(r.stock_total)
    }));
  }

  async getToolsInMaintenance(): Promise<MovementListItem[]> {
    const { data, error } = await supabase.from('view_tools_in_maintenance').select('*').order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getToolByCode(code: string): Promise<Tool | null> {
    const { data, error } = await supabase
      .from('herramientas')
      .select('*, categorias(nombre, codigo)')
      .eq('codigo_referencia', code)
      .is('num_serial', null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      categoria_nombre: data.categorias?.nombre,
      categoria_codigo: data.categorias?.codigo
    };
  }

  async getToolByCodeAndSerial(code: string, serial: string | null): Promise<Tool | null> {
    if (!serial) return this.getToolByCode(code);
    const { data, error } = await supabase
      .from('herramientas')
      .select('*, categorias(nombre, codigo)')
      .eq('codigo_referencia', code)
      .eq('num_serial', serial)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      categoria_nombre: data.categorias?.nombre,
      categoria_codigo: data.categorias?.codigo
    };
  }

  async registerMovement(m: Movement): Promise<void> {
    const { error } = await supabase.from('kardex_movimientos').insert([{
      id: m.id,
      herramienta_id: m.herramienta_id,
      trabajador_id: m.trabajador_id || null,
      ubicacion_id: m.ubicacion_id || null,
      linea_negocio_id: m.linea_negocio_id || null,
      tipo_movimiento: m.tipo_movimiento,
      cantidad: m.cantidad,
      estado_insumo: m.estado_insumo,
      observaciones: m.observaciones || null,
      usuario_sistema_id: m.usuario_sistema_id,
      fecha: m.fecha || new Date().toISOString()
    }]);
    if (error) throw error;
  }

  async registerMovements(movements: Movement[]): Promise<void> {
    const payload = movements.map(m => ({
      id: m.id,
      herramienta_id: m.herramienta_id,
      trabajador_id: m.trabajador_id || null,
      ubicacion_id: m.ubicacion_id || null,
      linea_negocio_id: m.linea_negocio_id || null,
      tipo_movimiento: m.tipo_movimiento,
      cantidad: m.cantidad,
      estado_insumo: m.estado_insumo,
      observaciones: m.observaciones || null,
      usuario_sistema_id: m.usuario_sistema_id,
      fecha: m.fecha || new Date().toISOString()
    }));
    const { error } = await supabase.from('kardex_movimientos').insert(payload);
    if (error) throw error;
  }

  async getBodegaId(): Promise<string> {
    const { data } = await supabase.from('ubicaciones').select('id').ilike('nombre_obra', '%BODEGA%').limit(1).maybeSingle();
    
    if (data?.id) return data.id;

    // Auto-create BODEGA if it doesn't exist in Supabase to satisfy foreign key constraints
    const defaultId = '00000000-0000-0000-0000-000000000002';
    await supabase.from('ubicaciones').insert([{
      id: defaultId,
      nombre_obra: 'BODEGA PRINCIPAL',
      estado: 'Activo'
    }]);

    return defaultId;
  }

  async getMovements(limit: number, offset: number, type?: string, startDate?: string, endDate?: string, collaboratorId?: string, locationId?: string, toolCode?: string, toolSerial?: string, businessLineId?: string): Promise<MovementListItem[]> {
    let query = supabase.from('kardex_movimientos').select('*, herramientas!inner(nombre, marca, codigo_referencia, num_serial), trabajadores(nombre), ubicaciones(nombre_obra), lineas_negocio(nombre)');
    
    if (type) query = query.eq('tipo_movimiento', type);
    if (startDate) query = query.gte('fecha', startDate);
    if (endDate) query = query.lte('fecha', endDate + 'T23:59:59.999Z');
    if (collaboratorId) query = query.eq('trabajador_id', collaboratorId);
    if (locationId) query = query.eq('ubicacion_id', locationId);
    if (businessLineId) query = query.eq('linea_negocio_id', businessLineId);
    if (toolCode) query = query.ilike('herramientas.codigo_referencia', `%${toolCode}%`);
    if (toolSerial) query = query.ilike('herramientas.num_serial', `%${toolSerial}%`);

    query = query.order('fecha', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) throw error;

    return data.map((r: any) => ({
      ...r,
      tool_nombre: r.herramientas?.nombre,
      tool_codigo: r.herramientas?.codigo_referencia,
      tool_serial: r.herramientas?.num_serial,
      tool_marca: r.herramientas?.marca,
      collaborator_nombre: r.trabajadores?.nombre,
      location_nombre: r.ubicaciones?.nombre_obra,
      business_line_nombre: r.lineas_negocio?.nombre
    }));
  }

  async getAssignedToolsByCode(code: string): Promise<MovementListItem[]> {
    const { data, error } = await supabase.from('view_assigned_tools').select('*').eq('tool_codigo', code).order('tool_serial', { ascending: true });
    if (error) throw error;
    return data;
  }

  async getAssignedToolsByFilter(
    collaboratorId?: string,
    locationId?: string,
    categoryType: 'tools' | 'supplies' | 'all' = 'all'
  ): Promise<MovementListItem[]> {
    if (!collaboratorId && !locationId) return [];
    let query = supabase.from('view_assigned_tools').select('*');
    if (collaboratorId) query = query.eq('trabajador_id', collaboratorId);
    if (locationId) query = query.eq('ubicacion_id', locationId);
    // Filtro de categoría: la vista debe exponer tool_categoria_codigo
    if (categoryType === 'tools') {
      query = (query as any).eq('tool_categoria_codigo', 'HERRAMIENTAS');
    } else if (categoryType === 'supplies') {
      query = (query as any).neq('tool_categoria_codigo', 'HERRAMIENTAS');
    }
    const { data, error } = await query.order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  }

  async createCollaborator(c: Collaborator): Promise<void> {
    const { error } = await supabase.from('trabajadores').insert([c]);
    if (error) throw error;
  }

  async getAllCollaborators(): Promise<Collaborator[]> {
    const { data, error } = await supabase.from('trabajadores').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createLocation(l: Location): Promise<void> {
    const { error } = await supabase.from('ubicaciones').insert([l]);
    if (error) throw error;
  }

  async getAllLocations(): Promise<Location[]> {
    const { data, error } = await supabase.from('ubicaciones').select('*').neq('nombre_obra', 'BODEGA').order('nombre_obra', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createBusinessLine(bl: BusinessLine): Promise<void> {
    const { error } = await supabase.from('lineas_negocio').insert([bl]);
    if (error) throw error;
  }

  async getAllBusinessLines(): Promise<BusinessLine[]> {
    const { data, error } = await supabase.from('lineas_negocio').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    return data;
  }

  // Categories (Maestro en Supabase)
  async createCategory(c: Category): Promise<void> {
    const { error } = await supabase.from('categorias').insert([{
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      descripcion: c.descripcion || null
    }]);
    if (error) throw error;
  }

  async getAllCategories(): Promise<Category[]> {
    const { data, error } = await supabase.from('categorias').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async updateCategory(c: Category): Promise<void> {
    const { error } = await supabase.from('categorias').update({
      codigo: c.codigo,
      nombre: c.nombre,
      descripcion: c.descripcion || null
    }).eq('id', c.id);
    if (error) throw error;
  }

  async deleteCategory(id: string): Promise<void> {
    const { count, error: countErr } = await supabase
      .from('herramientas')
      .select('id', { count: 'exact', head: true })
      .eq('categoria_id', id);

    if (!countErr && count && count > 0) {
      throw new Error(`No se puede eliminar la categoría porque tiene ${count} artículo(s) asociado(s).`);
    }
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) throw error;
  }

  async getDashboardStats(): Promise<{ dailyMovements: number; activeLoans: number }> {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) throw error;
    return {
      dailyMovements: data?.dailyMovements || 0,
      activeLoans: data?.activeLoans || 0
    };
  }

  async getToolLifeCycle(toolId: string): Promise<MovementListItem[]> {
    const { data, error } = await supabase
      .from('kardex_movimientos')
      .select('*, herramientas!inner(nombre, marca, codigo_referencia, num_serial), trabajadores(nombre), ubicaciones(nombre_obra), lineas_negocio(nombre)')
      .eq('herramienta_id', toolId)
      .order('fecha', { ascending: false });
    if (error) throw error;

    return data.map((r: any) => ({
      ...r,
      tool_nombre: r.herramientas?.nombre,
      tool_codigo: r.herramientas?.codigo_referencia,
      tool_serial: r.herramientas?.num_serial,
      tool_marca: r.herramientas?.marca,
      collaborator_nombre: r.trabajadores?.nombre,
      location_nombre: r.ubicaciones?.nombre_obra,
      business_line_nombre: r.lineas_negocio?.nombre
    }));
  }
}

export const getMovementRepository = async (isOnline: boolean): Promise<IMovementRepository> => {
  if (isOnline) {
    return new SupabaseMovementRepository();
  } else {
    const db = await SQLite.openDatabaseAsync('kardex.db');
    return new SQLiteMovementRepository(db);
  }
};

