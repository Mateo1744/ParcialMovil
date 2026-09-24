/**
 * RESUMEN DEL ARCHIVO
 * Este es el contenedor principal de EntreMóvil. Abre la base de datos SQLite,
 * comparte la sesión del usuario y registra todas las pantallas de navegación.
 */

// Expo Router permite navegar y crear la pila de pantallas de la aplicación.
import { router, Stack } from 'expo-router';
// SQLiteProvider abre una sola conexión y la comparte con toda la aplicación.
import { SQLiteProvider } from 'expo-sqlite';
// StatusBar controla el aspecto de la barra superior del dispositivo.
import { StatusBar } from 'expo-status-bar';
// Componentes básicos usados para construir el botón del encabezado.
import { Pressable, Text } from 'react-native';

// AuthProvider guarda el usuario autenticado y ofrece las funciones de sesión.
import { AuthProvider } from '@/context/auth-context';
// Esta función crea las tablas y el administrador inicial al abrir la base de datos.
import { initializeDatabase } from '@/database/database';

// Botón reutilizable que lleva al usuario a la pantalla principal.
function HomeHeaderButton() {
  return (
    <Pressable onPress={() => router.replace('/home')} style={{ paddingHorizontal: 8 }}>
      <Text style={{ color: '#176B87', fontSize: 15, fontWeight: '800' }}>Inicio</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  // Configuración que agrega el botón Inicio a las pantallas internas.
  const homeMenu = { headerRight: () => <HomeHeaderButton /> };

  return (
    // Abre o crea el archivo local entremovil5.db.
    <SQLiteProvider databaseName="entremovil5.db" onInit={initializeDatabase}>
      {/* Hace que la sesión esté disponible para todas las pantallas. */}
      <AuthProvider>
        {/* Usa iconos oscuros en la barra de estado. */}
        <StatusBar style="dark" />
        {/* Define el diseño común del encabezado y el fondo. */}
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTitleAlign: 'center',
            headerTintColor: '#14324A',
            contentStyle: { backgroundColor: '#F4F7FA' },
          }}>
          {/* Rutas públicas y pantalla que decide el destino inicial. */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          {/* El perfil es obligatorio en el primer ingreso de un cliente. */}
          <Stack.Screen
            name="perfil"
            options={{ title: 'Completar perfil', headerBackVisible: false, gestureEnabled: false }}
          />
          {/* Módulos principales solicitados en el proyecto. */}
          <Stack.Screen name="clientes" options={{ title: 'Cliente', ...homeMenu }} />
          <Stack.Screen name="productos" options={{ title: 'Producto', ...homeMenu }} />
          <Stack.Screen name="encabezados" options={{ title: 'Encabezado', ...homeMenu }} />
          <Stack.Screen name="nueva-compra" options={{ title: 'Nueva compra', ...homeMenu }} />
          <Stack.Screen name="detalles" options={{ title: 'Detalle', ...homeMenu }} />
          <Stack.Screen
            name="solicitudes"
            options={{ title: 'Solicitudes pendientes', ...homeMenu }}
          />
        </Stack>
      </AuthProvider>
    </SQLiteProvider>
  );
}
