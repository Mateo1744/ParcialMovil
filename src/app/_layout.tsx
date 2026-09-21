import { router, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';

import { AuthProvider } from '@/context/auth-context';
import { initializeDatabase } from '@/database/database';

function HomeHeaderButton() {
  return (
    <Pressable onPress={() => router.replace('/home')} style={{ paddingHorizontal: 8 }}>
      <Text style={{ color: '#176B87', fontSize: 15, fontWeight: '800' }}>Inicio</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const homeMenu = { headerRight: () => <HomeHeaderButton /> };

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
