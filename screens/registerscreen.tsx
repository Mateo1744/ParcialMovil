import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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

import { useAuth } from '@/context/auth-context';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setMessage('Ingresa un correo electrónico válido.');
      return;
    }

    if (password.length < 6) {
      setMessage('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await register(normalizedEmail, password);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      Alert.alert('Cuenta registrada', result.message, [
        { text: 'Entendido', onPress: () => router.replace('/login') },
      ]);
    } catch {
      setMessage('No fue posible crear la cuenta. Inténtalo nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={styles.title}>Crea tu cuenta</Text>
            <Text style={styles.subtitle}>
              Tu solicitud quedará pendiente hasta que un administrador la apruebe.
            </Text>
          </View>

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
            />

            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite la contraseña"
              placeholderTextColor="#8A98A6"
              secureTextEntry
              editable={!isLoading}
              onSubmitEditing={handleRegister}
            />

            {message ? <Text style={styles.errorText}>{message}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar solicitud</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 30 },
  intro: { width: '100%', maxWidth: 460, alignSelf: 'center', marginBottom: 24 },
  title: { color: '#14324A', fontSize: 29, fontWeight: '800' },
  subtitle: { color: '#5F7181', fontSize: 16, lineHeight: 23, marginTop: 8 },
  form: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#102A3C',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
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
});

