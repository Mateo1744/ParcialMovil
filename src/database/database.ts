/**
 * RESUMEN DEL ARCHIVO
 * Prepara la base de datos local de EntreMóvil. Crea las seis tablas, activa
 * sus relaciones, ejecuta migraciones y registra el administrador inicial.
 */

// Tipo de la conexión que entrega expo-sqlite.
import type { SQLiteDatabase } from 'expo-sqlite';

// Funciones usadas para guardar la clave inicial de forma protegida.
import { createSalt, hashPassword } from './password';

// Credenciales solicitadas para la cuenta administradora inicial.
const ADMIN_EMAIL = 'davidnaranjo337@gmail.com';
const ADMIN_PASSWORD = '123456';

// Se ejecuta cada vez que SQLiteProvider abre la base de datos.
export async function initializeDatabase(db: SQLiteDatabase) {
  // execAsync permite ejecutar varias instrucciones SQL seguidas.
  await db.execAsync(`
    -- WAL mejora la seguridad y el rendimiento de las escrituras.
    PRAGMA journal_mode = WAL;
    -- Activa el cumplimiento de las llaves foráneas.
    PRAGMA foreign_keys = ON;

    -- Login guarda credenciales, estado y rol de cada cuenta.
    CREATE TABLE IF NOT EXISTS Login (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'activo', 'inactivo')),
      rol TEXT NOT NULL DEFAULT 'cliente'
        CHECK (rol IN ('admin', 'cliente')),
      fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Cliente guarda los datos personales asociados a una cuenta cliente.
    CREATE TABLE IF NOT EXISTS Cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_login INTEGER NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_login) REFERENCES Login(id) ON DELETE CASCADE
    );

    -- Producto representa el inventario disponible para las compras.
    CREATE TABLE IF NOT EXISTS Producto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      valor_unitario REAL NOT NULL CHECK (valor_unitario > 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
    );

    -- Encabezado contiene la información general y total de cada compra.
    CREATE TABLE IF NOT EXISTS Encabezado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_cliente INTEGER NOT NULL,
      fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
      FOREIGN KEY (id_cliente) REFERENCES Cliente(id)
    );

    -- Detalles contiene cada producto, cantidad y subtotal de una compra.
    CREATE TABLE IF NOT EXISTS Detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_encabezado INTEGER NOT NULL,
      id_producto INTEGER NOT NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      valor REAL NOT NULL CHECK (valor >= 0),
      FOREIGN KEY (id_encabezado) REFERENCES Encabezado(id) ON DELETE CASCADE,
      FOREIGN KEY (id_producto) REFERENCES Producto(id)
    );

    -- Sesion conserva una única cuenta conectada entre aperturas de la app.
    CREATE TABLE IF NOT EXISTS Sesion (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      id_login INTEGER NOT NULL,
      FOREIGN KEY (id_login) REFERENCES Login(id) ON DELETE CASCADE
    );

  `);

  // Lee la versión interna para saber si hace falta transformar datos antiguos.
  const databaseVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

  // La versión 2 cambió Detalles.valor de precio unitario a subtotal.
  if (!databaseVersion || databaseVersion.user_version < 2) {
    // La transacción garantiza que actualización y cambio de versión ocurran juntos.
    await db.withTransactionAsync(async () => {
      // En la versión 1, Detalles.valor guardaba el precio unitario.
      // Desde la versión 2 guarda el subtotal: cantidad x precio unitario.
      await db.runAsync('UPDATE Detalles SET valor = valor * cantidad');
      await db.execAsync('PRAGMA user_version = 2');
    });
  }

  // Busca al administrador para no insertarlo de nuevo en cada inicio.
  const admin = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM Login WHERE correo = ?',
    ADMIN_EMAIL
  );

  // Solo crea la cuenta si aún no existe.
  if (!admin) {
    // Genera un salt y el hash de la contraseña antes de guardar.
    const salt = await createSalt();
    const passwordHash = await hashPassword(ADMIN_PASSWORD, salt);

    // El administrador inicial se crea activo para permitir el primer ingreso.
    await db.runAsync(
      `INSERT INTO Login (correo, password_hash, salt, estado, rol)
       VALUES (?, ?, ?, 'activo', 'admin')`,
      ADMIN_EMAIL,
      passwordHash,
      salt
    );
  }
}
