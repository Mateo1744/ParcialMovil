import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { user, loading, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function checkAccess() {
      if (loading) {
        return;
      }

      if (!user) {
        router.replace('/login');
        return;
      }

      if (user.rol === 'cliente') {
        const profile = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM Cliente WHERE id_login = ?',
          user.id
        );

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

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  if (loading || checkingProfile || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  const isAdmin = user.rol === 'admin';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
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

        <View style={styles.roleCard}>
          <Text style={styles.roleLabel}>ROL ACTUAL</Text>
          <Text style={styles.roleTitle}>{isAdmin ? 'Administrador' : 'Cliente'}</Text>
          <Text style={styles.roleDescription}>
            {isAdmin
              ? 'Tendrás acceso a usuarios, clientes, productos y compras.'
              : 'Podrás completar tu perfil, consultar productos y realizar compras.'}
          </Text>
        </View>

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
                  <Text style={styles.requestButtonTitle}>Encabezados y detalles</Text>
                  <Text style={styles.requestButtonDescription}>
                    Consulta y administra las compras realizadas.
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

        <Text style={styles.sectionTitle}>Primera etapa completada</Text>

        <View style={styles.cardGrid}>
          <View style={styles.moduleCard}>
            <Text style={styles.moduleNumber}>01</Text>
            <Text style={styles.moduleTitle}>Inicio de sesión</Text>
            <Text style={styles.moduleText}>Acceso validado por correo, contraseña y estado.</Text>
          </View>

          <View style={styles.moduleCard}>
            <Text style={styles.moduleNumber}>02</Text>
            <Text style={styles.moduleTitle}>Sesión persistente</Text>
            <Text style={styles.moduleText}>La sesión permanece activa al volver a abrir la app.</Text>
          </View>

          <View style={styles.moduleCard}>
            <Text style={styles.moduleNumber}>03</Text>
            <Text style={styles.moduleTitle}>Acceso por rol</Text>
            <Text style={styles.moduleText}>
              La pantalla identifica si ingresó un administrador o un cliente.
            </Text>
          </View>
        </View>

        <Text style={styles.nextStep}>
          En la siguiente etapa agregaremos el menú y las funciones correspondientes a cada rol.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  cardGrid: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 14 },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E9EE',
  },
  moduleNumber: { color: '#176B87', fontSize: 13, fontWeight: '900' },
  moduleTitle: { color: '#14324A', fontSize: 18, fontWeight: '800', marginTop: 8 },
  moduleText: { color: '#5F7181', fontSize: 15, lineHeight: 21, marginTop: 6 },
  nextStep: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    color: '#5F7181',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  buttonPressed: { opacity: 0.75 },
});
