/**
 * RESUMEN DEL ARCHIVO
 * Centraliza la autenticación. Recupera la sesión guardada, inicia sesión,
 * registra cuentas pendientes, actualiza el correo y cierra la sesión.
 */

// PropsWithChildren describe un componente que envuelve otras pantallas.
import type { PropsWithChildren } from 'react';
// Herramientas de React para compartir y actualizar el estado de sesión.
import { createContext, useContext, useEffect, useState } from 'react';
// Permite usar la misma conexión SQLite abierta en el layout principal.
import { useSQLiteContext } from 'expo-sqlite';

// Funciones para nunca guardar contraseñas en texto plano.
import { createSalt, hashPassword } from '@/database/password';

// Roles válidos dentro de la aplicación.
export type UserRole = 'admin' | 'cliente';

// Datos mínimos que necesita la interfaz sobre el usuario conectado.
export type AuthUser = {
  id: number;
  correo: string;
  rol: UserRole;
};

// Respuesta común de los procesos de ingreso y registro.
type AuthResult = {
  ok: boolean;
  message: string;
};

// Columnas adicionales usadas para validar el inicio de sesión.
type LoginRow = AuthUser & {
  password_hash: string;
  salt: string;
  estado: 'pendiente' | 'activo' | 'inactivo';
};

// Funciones y datos que estarán disponibles en todas las pantallas.
type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string) => Promise<AuthResult>;
  updateCurrentUserEmail: (email: string) => void;
  signOut: () => Promise<void>;
};

// El contexto comienza vacío hasta quedar dentro de AuthProvider.
const AuthContext = createContext<AuthContextValue | null>(null);

// Quita espacios y unifica el correo en minúsculas.
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: PropsWithChildren) {
  // Obtiene la conexión compartida con SQLite.
  const db = useSQLiteContext();
  // Guarda el usuario actual; null significa que no hay sesión.
  const [user, setUser] = useState<AuthUser | null>(null);
  // Evita redireccionar antes de consultar la sesión guardada.
  const [loading, setLoading] = useState(true);

  // Este efecto se ejecuta al iniciar la aplicación.
  useEffect(() => {
    // Busca la sesión número 1 y la relaciona con su cuenta.
    async function restoreSession() {
      try {
        const savedUser = await db.getFirstAsync<AuthUser & { estado: string }>(`
          SELECT l.id, l.correo, l.rol, l.estado
          FROM Sesion s
          INNER JOIN Login l ON l.id = s.id_login
          WHERE s.id = 1
        `);

        // Solo restaura cuentas que todavía estén activas.
        if (savedUser?.estado === 'activo') {
          setUser({ id: savedUser.id, correo: savedUser.correo, rol: savedUser.rol });
        } else {
          // Elimina sesiones inválidas, inactivas o huérfanas.
          await db.runAsync('DELETE FROM Sesion');
        }
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [db]);

  // Valida las credenciales y crea la sesión local.
  async function signIn(email: string, password: string): Promise<AuthResult> {
    // Normaliza el correo para que espacios o mayúsculas no afecten la búsqueda.
    const normalizedEmail = normalizeEmail(email);
    // Consulta la cuenta asociada al correo.
    const account = await db.getFirstAsync<LoginRow>(
      `SELECT id, correo, password_hash, salt, estado, rol
       FROM Login
       WHERE correo = ?`,
      normalizedEmail
    );

    // No se revela si el problema fue específicamente el correo.
    if (!account) {
      return { ok: false, message: 'El correo o la contraseña son incorrectos.' };
    }

    // Calcula el hash recibido usando el salt guardado.
    const passwordHash = await hashPassword(password, account.salt);
    if (passwordHash !== account.password_hash) {
      return { ok: false, message: 'El correo o la contraseña son incorrectos.' };
    }

    // Una cuenta nueva no ingresa hasta ser aprobada.
    if (account.estado === 'pendiente') {
      return {
        ok: false,
        message: 'Tu cuenta está pendiente de aprobación por un administrador.',
      };
    }

    // También se bloquean las cuentas rechazadas o inactivadas.
    if (account.estado !== 'activo') {
      return { ok: false, message: 'Tu cuenta está inactiva. Contacta al administrador.' };
    }

    // Solo se permite una sesión local: se reemplaza la anterior.
    await db.runAsync('DELETE FROM Sesion');
    await db.runAsync('INSERT INTO Sesion (id, id_login) VALUES (1, ?)', account.id);

    setUser({ id: account.id, correo: account.correo, rol: account.rol });
    return { ok: true, message: 'Inicio de sesión exitoso.' };
  }

  // Crea una cuenta cliente en estado pendiente.
  async function register(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(email);
    // Impide registrar dos veces el mismo correo.
    const existingAccount = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM Login WHERE correo = ?',
      normalizedEmail
    );

    if (existingAccount) {
      return { ok: false, message: 'Ya existe una cuenta registrada con ese correo.' };
    }

    // Protege la contraseña antes de insertarla.
    const salt = await createSalt();
    const passwordHash = await hashPassword(password, salt);

    // Todas las cuentas públicas nacen como cliente pendiente.
    await db.runAsync(
      `INSERT INTO Login (correo, password_hash, salt, estado, rol)
       VALUES (?, ?, ?, 'pendiente', 'cliente')`,
      normalizedEmail,
      passwordHash,
      salt
    );

    return {
      ok: true,
      message: 'Registro exitoso. Tu cuenta debe ser aprobada por un administrador.',
    };
  }

  // Borra la sesión persistente y limpia el usuario de React.
  async function signOut() {
    await db.runAsync('DELETE FROM Sesion');
    setUser(null);
  }

  // Mantiene el contexto sincronizado cuando el usuario cambia su correo.
  function updateCurrentUserEmail(email: string) {
    setUser((currentUser) =>
      currentUser ? { ...currentUser, correo: normalizeEmail(email) } : currentUser
    );
  }

  // Comparte datos y acciones con todos los componentes hijos.
  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, register, updateCurrentUserEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook corto para consumir el contexto desde cualquier pantalla.
export function useAuth() {
  const context = useContext(AuthContext);

  // Ayuda a detectar si alguien usa el hook fuera de AuthProvider.
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }

  return context;
}
