/**
 * RESUMEN DEL ARCHIVO
 * Esta ruta se ejecuta al abrir la aplicación y decide si se debe mostrar
 * el inicio de sesión o la pantalla principal.
 */

// Redirect cambia de ruta sin mostrar una pantalla intermedia.
import { Redirect } from 'expo-router';
// Componentes usados para mostrar el indicador de carga.
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Hook que permite consultar la sesión actual.
import { useAuth } from '@/context/auth-context';

export default function IndexScreen() {
  // user contiene la cuenta activa y loading indica si todavía se consulta SQLite.
  const { user, loading } = useAuth();

  // Mientras se recupera la sesión guardada se muestra una animación de carga.
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  // Con sesión activa va al inicio; sin sesión va al formulario de ingreso.
  return <Redirect href={user ? '/home' : '/login'} />;
}

// Estilos exclusivos del indicador de carga inicial.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FA',
  },
});
