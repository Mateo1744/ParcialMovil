import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { createSalt, hashPassword } from '@/database/password';

export type UserRole = 'admin' | 'cliente';

export type AuthUser = {
  id: number;
  correo: string;
  rol: UserRole;
};

type AuthResult = {
  ok: boolean;
  message: string;
};

type LoginRow = AuthUser & {
  password_hash: string;
  salt: string;
  estado: 'pendiente' | 'activo' | 'inactivo';
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const savedUser = await db.getFirstAsync<AuthUser & { estado: string }>(`
          SELECT l.id, l.correo, l.rol, l.estado
          FROM Sesion s
          INNER JOIN Login l ON l.id = s.id_login
          WHERE s.id = 1
        `);

        if (savedUser?.estado === 'activo') {
          setUser({ id: savedUser.id, correo: savedUser.correo, rol: savedUser.rol });
        } else {
          await db.runAsync('DELETE FROM Sesion');
        }
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [db]);

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(email);
    const account = await db.getFirstAsync<LoginRow>(
      `SELECT id, correo, password_hash, salt, estado, rol
       FROM Login
       WHERE correo = ?`,
      normalizedEmail
    );

    if (!account) {
      return { ok: false, message: 'El correo o la contraseña son incorrectos.' };
    }

    const passwordHash = await hashPassword(password, account.salt);
    if (passwordHash !== account.password_hash) {
      return { ok: false, message: 'El correo o la contraseña son incorrectos.' };
    }

    if (account.estado === 'pendiente') {
      return {
        ok: false,
        message: 'Tu cuenta está pendiente de aprobación por un administrador.',
      };
    }

    if (account.estado !== 'activo') {
      return { ok: false, message: 'Tu cuenta está inactiva. Contacta al administrador.' };
    }

    await db.runAsync('DELETE FROM Sesion');
    await db.runAsync('INSERT INTO Sesion (id, id_login) VALUES (1, ?)', account.id);

    setUser({ id: account.id, correo: account.correo, rol: account.rol });
    return { ok: true, message: 'Inicio de sesión exitoso.' };
  }

  async function register(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(email);
    const existingAccount = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM Login WHERE correo = ?',
      normalizedEmail
    );

    if (existingAccount) {
      return { ok: false, message: 'Ya existe una cuenta registrada con ese correo.' };
    }

    const salt = await createSalt();
    const passwordHash = await hashPassword(password, salt);

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

  async function signOut() {
    await db.runAsync('DELETE FROM Sesion');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }

  return context;
}

