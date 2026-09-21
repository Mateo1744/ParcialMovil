import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
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

import { useAuth } from '@/context/auth-context';

export default function ClientProfileScreen() {
  const db = useSQLiteContext();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function checkProfile() {
      if (authLoading) {
        return;
      }

      if (!user || user.rol !== 'cliente') {
        router.replace('/home');
        return;
      }

      const existingProfile = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM Cliente WHERE id_login = ?',
        user.id
      );

      if (!isActive) {
        return;
      }

      if (existingProfile) {
        router.replace('/home');
        return;
      }

      setCheckingProfile(false);
    }

    checkProfile().catch(() => {
      if (isActive) {
        setError('No fue posible verificar el perfil. Inténtalo nuevamente.');
        setCheckingProfile(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [authLoading, db, user]);

  async function handleSave() {
    const cleanName = name.trim();
    const cleanLastName = lastName.trim();
    setError('');

    if (cleanName.length < 2 || cleanLastName.length < 2) {
      setError('Escribe un nombre y un apellido válidos.');
      return;
    }

    if (!user || user.rol !== 'cliente') {
      setError('No se encontró una sesión de cliente válida.');
      return;
    }

    try {
      setSaving(true);

      const existingProfile = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM Cliente WHERE id_login = ?',
        user.id
      );

      if (!existingProfile) {
        await db.runAsync(
          `INSERT INTO Cliente (id_login, nombre, apellido, correo)
           VALUES (?, ?, ?, ?)`,
          user.id,
          cleanName,
          cleanLastName,
          user.correo
        );
      }

      router.replace('/home');
    } catch {
      setError('No fue posible guardar el perfil. Verifica los datos e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || checkingProfile || !user || user.rol !== 'cliente') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.introCard}>
            <Text style={styles.stepLabel}>ÚLTIMO PASO</Text>
            <Text style={styles.title}>Completa tu perfil</Text>
            <Text style={styles.subtitle}>
              Necesitamos tus datos personales antes de continuar como cliente.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Correo electrónico</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{user.correo}</Text>
            </View>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ejemplo: Mateo"
              placeholderTextColor="#8A98A6"
              autoCapitalize="words"
              editable={!saving}
            />

            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Ejemplo: Naranjo"
              placeholderTextColor="#8A98A6"
              autoCapitalize="words"
              editable={!saving}
              onSubmitEditing={handleSave}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar y continuar</Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FA',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 660,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  introCard: {
    backgroundColor: '#176B87',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  stepLabel: { color: '#B8E3EF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginTop: 7 },
  subtitle: { color: '#E7F5F8', fontSize: 16, lineHeight: 23, marginTop: 7 },
  form: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E2E9EE',
    padding: 24,
  },
  label: { color: '#14324A', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D8E1E8',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#14324A',
    backgroundColor: '#FAFCFD',
    fontSize: 16,
    marginBottom: 18,
  },
  readOnlyInput: {
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8E1E8',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#EDF2F5',
    marginBottom: 18,
  },
  readOnlyText: { color: '#5F7181', fontSize: 16 },
  errorText: {
    color: '#B42318',
    backgroundColor: '#FFF1F0',
    borderRadius: 10,
    padding: 12,
    lineHeight: 20,
    marginBottom: 16,
  },
  saveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#176B87',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.65 },
});
