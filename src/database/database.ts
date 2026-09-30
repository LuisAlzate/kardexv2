import * as SQLite from 'expo-sqlite';

/**
 * Database initialization for Kardex System
 * Follows the schema defined in KARDEX.txt
 */
export const initDatabase = async () => {
  const db = await SQLite.openDatabaseAsync('kardex.db');

  // RESET NUCLEAR: Borrar todo para empezar de cero con esquema limpio
  // Solo usar cuando hay problemas de esquema persistentes
  /*
  console.log('RESETTING DATABASE...');
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS kardex_movimientos;
    DROP TABLE IF EXISTS herramientas;
    DROP TABLE IF EXISTS ubicaciones;
    DROP TABLE IF EXISTS trabajadores;
    DROP TABLE IF EXISTS rol_permisos;
    DROP TABLE IF EXISTS usuarios_sistema;
    PRAGMA foreign_keys = ON;
  `);
  */

  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS usuarios_sistema (
      id TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      documento TEXT UNIQUE,
      rol TEXT CHECK(rol IN ('admin', 'revisor', 'operario')) NOT NULL,
      password_hash TEXT NOT NULL,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rol_permisos (
      id TEXT PRIMARY KEY NOT NULL,
      rol TEXT NOT NULL,
      pantalla TEXT NOT NULL,
      puede_ver INTEGER DEFAULT 1,
      puede_editar INTEGER DEFAULT 0,
      UNIQUE(rol, pantalla)
    );

    CREATE TABLE IF NOT EXISTS trabajadores (
      id TEXT PRIMARY KEY NOT NULL,
      cedula TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      cargo TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ubicaciones (
      id TEXT PRIMARY KEY NOT NULL,
      nombre_obra TEXT NOT NULL,
      responsable_obra_id TEXT,
      estado TEXT CHECK(estado IN ('Activo', 'Cerrado')) NOT NULL DEFAULT 'Activo',
      FOREIGN KEY (responsable_obra_id) REFERENCES trabajadores (id)
    );

    CREATE TABLE IF NOT EXISTS lineas_negocio (
      id TEXT PRIMARY KEY NOT NULL,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS herramientas (
      id TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      marca TEXT,
      descripcion TEXT,
      codigo_referencia TEXT NOT NULL,
      num_serial TEXT,
      fecha_compra TEXT,
      estanteria TEXT,
      UNIQUE(codigo_referencia, num_serial)
    );

    CREATE TABLE IF NOT EXISTS kardex_movimientos (
      id TEXT PRIMARY KEY NOT NULL,
      herramienta_id TEXT NOT NULL,
      trabajador_id TEXT,
      ubicacion_id TEXT,
      linea_negocio_id TEXT,
      tipo_movimiento TEXT CHECK(tipo_movimiento IN ('ENTRADA', 'SALIDA', 'DEVOLUCION', 'MANTENIMIENTO')) NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      estado_insumo TEXT CHECK(estado_insumo IN ('BUENA', 'MALA')) NOT NULL,
      observaciones TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      usuario_sistema_id TEXT NOT NULL,
      FOREIGN KEY (herramienta_id) REFERENCES herramientas (id),
      FOREIGN KEY (trabajador_id) REFERENCES trabajadores (id),
      FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones (id),
      FOREIGN KEY (linea_negocio_id) REFERENCES lineas_negocio (id),
      FOREIGN KEY (usuario_sistema_id) REFERENCES usuarios_sistema (id)
    );

    -- Seed initial permissions (Ensure all roles have entries for all screens)
    INSERT OR IGNORE INTO rol_permisos (id, rol, pantalla, puede_ver, puede_editar) VALUES
    -- Admin
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p1', 'admin', 'dashboard', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p2', 'admin', 'inventory_entry', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p3', 'admin', 'inventory_exit', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p4', 'admin', 'inventory_list', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p5', 'admin', 'collaborators', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p6', 'admin', 'locations', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p7', 'admin', 'movement_history', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p8', 'admin', 'user_management', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p25', 'admin', 'business_lines', 1, 1),
    -- Revisor
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p9', 'revisor', 'dashboard', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p10', 'revisor', 'inventory_entry', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p11', 'revisor', 'inventory_exit', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p12', 'revisor', 'inventory_list', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p13', 'revisor', 'collaborators', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p14', 'revisor', 'locations', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p15', 'revisor', 'movement_history', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p16', 'revisor', 'user_management', 0, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p26', 'revisor', 'business_lines', 1, 0),
    -- Operario
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p17', 'operario', 'dashboard', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p18', 'operario', 'inventory_entry', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p19', 'operario', 'inventory_exit', 1, 1),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p20', 'operario', 'inventory_list', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p21', 'operario', 'collaborators', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p22', 'operario', 'locations', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p23', 'operario', 'movement_history', 1, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p24', 'operario', 'user_management', 0, 0),
    (REPLACE(hex(randomblob(4)), ' ', '') || '-p27', 'operario', 'business_lines', 1, 0);

    -- Seed initial admin user if not exists (password: admin123)
    INSERT OR IGNORE INTO usuarios_sistema (id, nombre, email, rol, password_hash)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Administrador', 'admin@kardex.com', 'admin', 'admin123');

    -- Seed BODEGA location
    INSERT OR IGNORE INTO ubicaciones (id, nombre_obra, estado)
    VALUES ('00000000-0000-0000-0000-000000000002', 'BODEGA', 'Activo');
  `);

  // Migration: Ensure 'cantidad' column exists in kardex_movimientos
  try {
    const tableInfo = await db.getAllAsync<any>("PRAGMA table_info(kardex_movimientos)");
    const hasCantidad = tableInfo.some(col => col.name === 'cantidad');
    if (!hasCantidad) {
      await db.runAsync("ALTER TABLE kardex_movimientos ADD COLUMN cantidad INTEGER NOT NULL DEFAULT 1;");
      console.log('Added cantidad column to kardex_movimientos');
    }
    const hasLineaNegocio = tableInfo.some(col => col.name === 'linea_negocio_id');
    if (!hasLineaNegocio) {
      await db.runAsync("ALTER TABLE kardex_movimientos ADD COLUMN linea_negocio_id TEXT;");
      console.log('Added linea_negocio_id column to kardex_movimientos');
    }
  } catch (e) {
    console.error('Migration error (cantidad):', e);
  }

  // These are now empty as we did a full reset. 
  // We keep them as placeholders if future migrations are needed.
  const ensureUserSchema = async () => { };
  const ensureHerramientasSchema = async () => {
    try {
      const tableInfo = await db.getAllAsync<any>("PRAGMA table_info(herramientas)");
      const hasEstanteria = tableInfo.some(col => col.name === 'estanteria');
      if (!hasEstanteria) {
        await db.runAsync("ALTER TABLE herramientas ADD COLUMN estanteria TEXT;");
        console.log('Added estanteria column to herramientas');
      }
    } catch (e) {
      console.error('Migration error (esanteria):', e);
    }
  };

  const migrateColumn = async (tableName: string, columnName: string, definition: string) => {
    try {
      const info = await db.getAllAsync<any>(`PRAGMA table_info(${tableName})`);
      if (info.some(col => col.name === columnName)) return;
      await db.runAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
    } catch (e: any) {
      try {
        await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
      } catch (innerE) { /* Ignore */ }
    }
  };

  await ensureUserSchema();
  await ensureHerramientasSchema();

  // Final Schema Check for debugging
  try {
    const toolInfo = await db.getAllAsync<any>("PRAGMA table_info(herramientas)");
    console.log('Final Verified Schema (tools):', toolInfo.map(c => c.name).join(', '));
  } catch (e) { }

  // Ensure the index exists, ignoring if table not ready
  await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_documento ON usuarios_sistema(documento);`).catch(() => { });

  console.log('Database initialized successfully with FRESH SCHEMA');

  // Seed dummy data for testing
  await seedDummyData(db);

  return db;
};

/**
 * Seeds the database with dummy data for testing purposes.
 */
const seedDummyData = async (db: SQLite.SQLiteDatabase) => {
  console.log('Seeding dummy data...');
  try {
    // 1. Trabajadores (Collaborators)
    await db.execAsync(`
      INSERT OR IGNORE INTO trabajadores (id, cedula, nombre, cargo) VALUES
      ('worker-1', '1010', 'JUAN PÉREZ', 'INGENIERO DE OBRA'),
      ('worker-2', '2020', 'MARÍA GARCÍA', 'OPERARIA'),
      ('worker-3', '3030', 'LUIS RODRÍGUEZ', 'ALMACENISTA'),
      ('worker-4', '4040', 'ANA MARTÍNEZ', 'RESIDENTE'),
      ('worker-5', '5050', 'PEDRO GÓMEZ', 'MAESTRO DE OBRA');
    `);

    // 2. Ubicaciones (Locations)
    await db.execAsync(`
      INSERT OR IGNORE INTO ubicaciones (id, nombre_obra, estado) VALUES
      ('loc-1', 'PROYECTO NORTE - TORRE A', 'Activo'),
      ('loc-2', 'SEDE PRINCIPAL - TALLER', 'Activo'),
      ('loc-3', 'OBRA SUR - CIMENTACIÓN', 'Activo');
    `);

    // 3. Herramientas (Tools)
    // Mixed: some with serial, some without
    await db.execAsync(`
      INSERT OR IGNORE INTO herramientas (id, nombre, marca, descripcion, codigo_referencia, num_serial, fecha_compra) VALUES
      ('tool-1', 'TALADRO PERCUTOR 1/2', 'DEWALT', 'Taladro industrial', 'DW-001', 'SN-1001', '2023-01-15'),
      ('tool-2', 'TALADRO PERCUTOR 1/2', 'DEWALT', 'Taladro industrial', 'DW-001', 'SN-1002', '2023-01-15'),
      ('tool-3', 'SIERRA CIRCULAR 7-1/4', 'BOSCH', 'Sierra para madera', 'BS-500', 'SN-2001', '2023-05-20'),
      ('tool-4', 'MULTÍMETRO DIGITAL', 'FLUKE', 'Equipo de medición', 'FL-115', 'SN-9001', '2022-11-10'),
      ('tool-5', 'CASCO DE SEGURIDAD BLANCO', '3M', 'Protección personal', 'CASCO-01', NULL, '2024-02-01'),
      ('tool-6', 'GUANTES DE NITRILO (PAR)', 'ZUBIOLA', 'Protección manos', 'GUANTE-01', NULL, '2024-02-01'),
      ('tool-7', 'GAFAS DE SEGURIDAD TRANSPARENTE', 'LIBUS', 'Protección visual', 'GAFA-01', NULL, '2024-02-01'),
      ('tool-8', 'NIVEL DE BURBUJA 24"', 'STANLEY', 'Herramienta de nivelación', 'ST-42', NULL, '2023-08-15');
    `);

    // 4. Kardex Movimientos (Initial Stock)
    // We register initial entries for these tools into BODEGA
    const now = new Date().toISOString();
    await db.execAsync(`
      INSERT OR IGNORE INTO kardex_movimientos 
      (id, herramienta_id, ubicacion_id, tipo_movimiento, cantidad, estado_insumo, observaciones, fecha, usuario_sistema_id) VALUES
      ('mov-1', 'tool-1', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 1, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001'),
      ('mov-2', 'tool-2', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 1, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001'),
      ('mov-3', 'tool-3', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 1, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001'),
      ('mov-4', 'tool-4', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 1, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001'),
      ('mov-5', 'tool-5', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 50, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001'),
      ('mov-6', 'tool-6', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 100, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001'),
      ('mov-7', 'tool-7', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 30, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001'),
      ('mov-8', 'tool-8', '00000000-0000-0000-0000-000000000002', 'ENTRADA', 5, 'BUENA', 'Carga inicial dummy', '${now}', '00000000-0000-0000-0000-000000000001');
    `);

    console.log('Dummy data seeded successfully');
  } catch (err) {
    console.error('Error seeding dummy data:', err);
  }
};
