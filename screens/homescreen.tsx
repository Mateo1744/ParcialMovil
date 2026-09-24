/**
 * RESUMEN DEL ARCHIVO
 * Es el menú principal. Comprueba que la sesión sea válida, obliga al cliente
 * nuevo a completar su perfil y muestra módulos diferentes según el rol.
 */

// Hooks para comprobar acceso y controlar el cierre de sesión.
import { useEffect, useState } from 'react';
// Permite abrir los diferentes módulos de la aplicación.
import { router } from 'expo-router';
// Conexión compartida para verificar el perfil del cliente.
import { useSQLiteContext } from 'expo-sqlite';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Proporciona usuario, carga y cierre de sesión.
import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  // Dependencias principales de la pantalla.
  const db = useSQLiteContext();
  const { user, loading, signOut } = useAuth();
  // Estados usados para mostrar indicadores de carga.
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  // Verifica la sesión y el perfil cada vez que cambia el usuario.
  useEffect(() => {
    let isActive = true;

    // Controla que nadie vea el inicio sin una sesión válida.
    async function checkAccess() {
      if (loading) {
        return;
      }

      // Una sesión vacía se redirige al login.
      if (!user) {
        router.replace('/login');
        return;
      }

      // Un cliente debe tener datos personales antes de usar los módulos.
      if (user.rol === 'cliente') {
        const profile = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM Cliente WHERE id_login = ?',
          user.id
        );

        // Si no existe Cliente, abre el formulario obligatorio.
        if (!profile) {
          router.replace('/perfil');
          return;
        }
      }

      if (isActive) {
        setCheckingProfile(false);
      }
    }

    checkAccess().catch(() => {
      if (isActive) {
        setCheckingProfile(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [db, loading, user]);

  // Elimina la sesión local y vuelve al login.
  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  // Evita mostrar el menú antes de terminar las comprobaciones.
  if (loading || checkingProfile || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  // Esta variable simplifica las condiciones visuales por rol.
  const isAdmin = user.rol === 'admin';

  // Interfaz principal de la aplicación.
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Encabezado con correo de la sesión y cierre de sesión. */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hola</Text>
            <Text style={styles.email}>{user.correo}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
            onPress={handleSignOut}
            disabled={isSigningOut}>
            {isSigningOut ? (
              <ActivityIndicator color="#176B87" />
            ) : (
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            )}
          </Pressable>
        </View>

        {/* Tarjeta que identifica claramente el rol conectado. */}
        <View style={styles.roleCard}>
          <Text style={styles.roleLabel}>ROL ACTUAL</Text>
          <Text style={styles.roleTitle}>{isAdmin ? 'Administrador' : 'Cliente'}</Text>
          <Text style={styles.roleDescription}>
            {isAdmin
              ? 'Administra solicitudes, clientes, productos y compras.'
              : 'Consulta tu perfil, revisa productos y realiza tus compras.'}
          </Text>
        </View>

        {/* El administrador ve módulos CRUD; el cliente ve solo sus opciones. */}
        {isAdmin ? (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>Administración</Text>
            <View style={styles.adminActions}>
              <Pressable
                style={({ pressed }) => [styles.requestButton, pressed && styles.buttonPressed]}
                onPress={() => router.push('/solicitudes')}>
                <View style={styles.requestButtonText}>
                  <Text style={styles.requestButtonTitle}>Solicitudes pendientes</Text>
                  <Text style={styles.requestButtonDescription}>
                    Aprueba o rechaza las cuentas nuevas.
                  </Text>
                </View>
                <Text style={styles.requestButtonArrow}>›</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.requestButton, pressed && styles.buttonPressed]}
                onPress={() => router.push('/clientes')}>
                <View style={styles.requestButtonText}>
                  <Text style={styles.requestButtonTitle}>Clientes</Text>
                  <Text style={styles.requestButtonDescription}>
                    Consulta y administra los clientes registrados.
                  </Text>
                </View>
                <Text style={styles.requestButtonArrow}>›</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.requestButton, pressed && styles.buttonPressed]}
                onPress={() => router.push('/productos')}>
                <View style={styles.requestButtonText}>
                  <Text style={styles.requestButtonTitle}>Productos</Text>
                  <Text style={styles.requestButtonDescription}>
                    Crea, consulta, edita y elimina productos.
                  </Text>
                </View>
                <Text style={styles.requestButtonArrow}>›</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.requestButton, pressed && styles.buttonPressed]}
                onPress={() => router.push('/encabezados')}>
                <View style={styles.requestButtonText}>
                  <Text style={styles.requestButtonTitle}>Compras</Text>
                  <Text style={styles.requestButtonDescription}>
                    Consulta y administra encabezados y detalles.
                  </Text>
                </View>
                <Text style={styles.requestButtonArrow}>›</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>Mi cuenta</Text>
            <Pressable
              style={({ pressed }) => [styles.requestButton, pressed && styles.buttonPressed]}
              onPress={() => router.push('/clientes')}>
              <View style={styles.requestButtonText}>
                <Text style={styles.requestButtonTitle}>Mi perfil de cliente</Text>
                <Text style={styles.requestButtonDescription}>Consulta tus datos personales.</Text>
              </View>
              <Text style={styles.requestButtonArrow}>›</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.requestButton,
                styles.clientProductButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push('/productos')}>
              <View style={styles.requestButtonText}>
                <Text style={styles.requestButtonTitle}>Productos</Text>
                <Text style={styles.requestButtonDescription}>
                  Consulta precios y productos disponibles.
                </Text>
              </View>
              <Text style={styles.requestButtonArrow}>›</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.requestButton,
                styles.clientProductButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push('/encabezados')}>
              <View style={styles.requestButtonText}>
                <Text style={styles.requestButtonTitle}>Mis compras</Text>
                <Text style={styles.requestButtonDescription}>
                  Crea una compra o consulta su encabezado y detalle.
                </Text>
              </View>
              <Text style={styles.requestButtonArrow}>›</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos del menú principal y sus tarjetas de navegación.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FA',
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 28,
  },
  headerText: { flex: 1 },
  greeting: { color: '#5F7181', fontSize: 15 },
  email: { color: '#14324A', fontSize: 18, fontWeight: '800', marginTop: 3 },
  logoutButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#AAC1CE',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  logoutText: { color: '#176B87', fontWeight: '800' },
  roleCard: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: '#176B87',
    borderRadius: 22,
    padding: 25,
    marginBottom: 30,
  },
  roleLabel: { color: '#B8E3EF', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  roleTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 8 },
  roleDescription: { color: '#E7F5F8', fontSize: 16, lineHeight: 23, marginTop: 8 },
  adminSection: { width: '100%', maxWidth: 760, alignSelf: 'center', marginBottom: 28 },
  adminActions: { gap: 12 },
  sectionTitle: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    color: '#14324A',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 15,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFE1E8',
    borderRadius: 16,
    padding: 20,
  },
  requestButtonText: { flex: 1, paddingRight: 12 },
  requestButtonTitle: { color: '#14324A', fontSize: 18, fontWeight: '800' },
  requestButtonDescription: { color: '#5F7181', fontSize: 15, marginTop: 5 },
  requestButtonArrow: { color: '#176B87', fontSize: 34, lineHeight: 34, fontWeight: '500' },
  clientProductButton: { marginTop: 12 },
  buttonPressed: { opacity: 0.75 },
});
