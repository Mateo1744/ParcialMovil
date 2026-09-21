import type { SQLiteDatabase } from 'expo-sqlite';

import { createSalt, hashPassword } from './password';

const ADMIN_EMAIL = 'davidnaranjo337@gmail.com';
const ADMIN_PASSWORD = '123456';

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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

    CREATE TABLE IF NOT EXISTS Cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_login INTEGER NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_login) REFERENCES Login(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Producto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      valor_unitario REAL NOT NULL CHECK (valor_unitario > 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
    );

    CREATE TABLE IF NOT EXISTS Encabezado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_cliente INTEGER NOT NULL,
      fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
      FOREIGN KEY (id_cliente) REFERENCES Cliente(id)
    );

    CREATE TABLE IF NOT EXISTS Detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_encabezado INTEGER NOT NULL,
      id_producto INTEGER NOT NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      valor REAL NOT NULL CHECK (valor >= 0),
      FOREIGN KEY (id_encabezado) REFERENCES Encabezado(id) ON DELETE CASCADE,
      FOREIGN KEY (id_producto) REFERENCES Producto(id)
    );

    CREATE TABLE IF NOT EXISTS Sesion (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      id_login INTEGER NOT NULL,
      FOREIGN KEY (id_login) REFERENCES Login(id) ON DELETE CASCADE
    );

  `);

  const databaseVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

  if (!databaseVersion || databaseVersion.user_version < 2) {
    await db.withTransactionAsync(async () => {
      // En la versión 1, Detalles.valor guardaba el precio unitario.
      // Desde la versión 2 guarda el subtotal: cantidad x precio unitario.
      await db.runAsync('UPDATE Detalles SET valor = valor * cantidad');
      await db.execAsync('PRAGMA user_version = 2');
    });
  }

  const admin = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM Login WHERE correo = ?',
    ADMIN_EMAIL
  );

  if (!admin) {
    const salt = await createSalt();
    const passwordHash = await hashPassword(ADMIN_PASSWORD, salt);

    await db.runAsync(
      `INSERT INTO Login (correo, password_hash, salt, estado, rol)
       VALUES (?, ?, ?, 'activo', 'admin')`,
      ADMIN_EMAIL,
      passwordHash,
      salt
    );
  }
}
