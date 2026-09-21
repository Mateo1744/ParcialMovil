import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/context/auth-context';
import { initializeDatabase } from '@/database/database';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="entremovil5.db" onInit={initializeDatabase}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTitleAlign: 'center',
            headerTintColor: '#14324A',
            contentStyle: { backgroundColor: '#F4F7FA' },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen
            name="perfil"
            options={{ title: 'Completar perfil', headerBackVisible: false, gestureEnabled: false }}
          />
          <Stack.Screen name="clientes" options={{ title: 'Cliente' }} />
          <Stack.Screen name="productos" options={{ title: 'Producto' }} />
          <Stack.Screen name="encabezados" options={{ title: 'Encabezado' }} />
          <Stack.Screen name="nueva-compra" options={{ title: 'Nueva compra' }} />
          <Stack.Screen name="detalles" options={{ title: 'Detalle' }} />
          <Stack.Screen name="solicitudes" options={{ title: 'Solicitudes pendientes' }} />
        </Stack>
      </AuthProvider>
    </SQLiteProvider>
  );
}
