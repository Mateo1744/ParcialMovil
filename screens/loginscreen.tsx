/**
 * RESUMEN DEL ARCHIVO
 * Muestra el formulario de inicio de sesión, valida que haya datos y utiliza
 * el contexto de autenticación para permitir o negar el acceso.
 */

// useState conserva lo escrito y el estado del formulario.
import { useState } from 'react';
// router cambia de pantalla después de una acción.
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// useAuth entrega la función central de inicio de sesión.
import { useAuth } from '@/context/auth-context';

export default function LoginScreen() {
  // Obtiene la acción signIn desde el contexto compartido.
  const { signIn } = useAuth();
  // Estados controlados por los campos y la interfaz.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Se ejecuta al presionar el botón o enviar la contraseña.
  async function handleLogin() {
    // Borra mensajes anteriores antes de volver a validar.
    setMessage('');

    // Ambos campos son obligatorios.
    if (!email.trim() || !password) {
      setMessage('Completa el correo y la contraseña.');
      return;
    }

    try {
      // Desactiva el formulario mientras SQLite verifica la cuenta.
      setIsLoading(true);
      const result = await signIn(email, password);

      // Muestra el mensaje específico: credenciales, pendiente o inactiva.
      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      // Reemplaza la ruta para evitar volver al login con el botón Atrás.
      router.replace('/home');
    } catch {
      setMessage('No fue posible iniciar sesión. Inténtalo nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }

  // Interfaz visual del formulario.
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brandCircle}>
            <Text style={styles.brandLetter}>E</Text>
          </View>

          <Text style={styles.appName}>EntreMóvil</Text>
          <Text style={styles.title}>Bienvenido</Text>
          <Text style={styles.subtitle}>Ingresa para continuar en la aplicación</Text>

          {/* Tarjeta que contiene correo, contraseña y acciones. */}
          <View style={styles.form}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#8A98A6"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isLoading}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#8A98A6"
              secureTextEntry
              editable={!isLoading}
              onSubmitEditing={handleLogin}
            />

            {/* El mensaje solo se dibuja cuando existe un error. */}
            {message ? <Text style={styles.errorText}>{message}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
              )}
            </Pressable>

            {/* Acceso al registro para usuarios que todavía no tienen cuenta. */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>¿No tienes una cuenta?</Text>
              <Pressable onPress={() => router.push('/register')} disabled={isLoading}>
                <Text style={styles.registerLink}> Regístrate</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Estilos de presentación; no contienen lógica del negocio.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  brandCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#176B87',
    marginBottom: 22,
  },
  brandLetter: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
  appName: {
    color: '#176B87',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 7,
  },
  title: {
    color: '#14324A',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#5F7181',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 30,
  },
  form: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 8px 16px rgba(16, 42, 60, 0.08)',
    elevation: 3,
  },
  label: {
    color: '#14324A',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D8E1E8',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#14324A',
    backgroundColor: '#FAFCFD',
    fontSize: 16,
    marginBottom: 17,
  },
  errorText: {
    color: '#B42318',
    backgroundColor: '#FFF1F0',
    borderRadius: 10,
    padding: 12,
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176B87',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.65 },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  registerText: { color: '#5F7181', fontSize: 15 },
  registerLink: { color: '#176B87', fontSize: 15, fontWeight: '800' },
});
