import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';

type PendingRequest = {
  id: number;
  correo: string;
  fecha_creacion: string;
};

type Message = {
  type: 'success' | 'error';
  text: string;
};

function formatDate(value: string) {
  const date = new Date(`${value.replace(' ', 'T')}Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PendingRequestsScreen() {
  const db = useSQLiteContext();
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db.getAllAsync<PendingRequest>(`
        SELECT id, correo, fecha_creacion
        FROM Login
        WHERE rol = 'cliente' AND estado = 'pendiente'
        ORDER BY fecha_creacion ASC, id ASC
      `);
      setRequests(rows);
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar las solicitudes.' });
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (!authLoading && (!user || user.rol !== 'admin')) {
      router.replace('/home');
    }
  }, [authLoading, user]);

  useFocusEffect(
    useCallback(() => {
      if (user?.rol === 'admin') {
        loadRequests();
      }
    }, [loadRequests, user?.rol])
  );

  async function changeStatus(request: PendingRequest, status: 'activo' | 'inactivo') {
    try {
      setProcessingId(request.id);
      setMessage(null);

      const result = await db.runAsync(
        `UPDATE Login
         SET estado = ?
         WHERE id = ? AND rol = 'cliente' AND estado = 'pendiente'`,
        status,
        request.id
      );

      if (result.changes === 0) {
        setMessage({
          type: 'error',
          text: 'La solicitud ya había sido procesada. Se actualizará la lista.',
        });
      } else {
        setMessage({
          type: 'success',
          text:
            status === 'activo'
              ? `La cuenta ${request.correo} fue aprobada.`
              : `La solicitud de ${request.correo} fue rechazada.`,
        });
      }

      await loadRequests();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible actualizar la solicitud.' });
    } finally {
      setProcessingId(null);
    }
  }

  if (authLoading || !user || user.rol !== 'admin') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Solicitudes de acceso</Text>
          <Text style={styles.introText}>
            Revisa las cuentas nuevas. Al aprobarlas, los usuarios podrán iniciar sesión.
          </Text>
        </View>

        {message ? (
          <View style={[styles.message, message.type === 'error' ? styles.error : styles.success]}>
            <Text style={message.type === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#176B87" />
            <Text style={styles.loadingText}>Cargando solicitudes...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay solicitudes pendientes</Text>
            <Text style={styles.emptyText}>Las cuentas nuevas aparecerán en esta sección.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.countText}>
              {requests.length} {requests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
            </Text>

            {requests.map((request) => {
              const isProcessing = processingId === request.id;

              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.pendingLabel}>PENDIENTE</Text>
                    <Text style={styles.email}>{request.correo}</Text>
                    <Text style={styles.date}>Enviada: {formatDate(request.fecha_creacion)}</Text>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.rejectButton,
                        pressed && styles.buttonPressed,
                        isProcessing && styles.buttonDisabled,
                      ]}
                      onPress={() => changeStatus(request, 'inactivo')}
                      disabled={processingId !== null}>
                      <Text style={styles.rejectText}>Rechazar</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.approveButton,
                        pressed && styles.buttonPressed,
                        isProcessing && styles.buttonDisabled,
                      ]}
                      onPress={() => changeStatus(request, 'activo')}
                      disabled={processingId !== null}>
                      {isProcessing ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.approveText}>Aprobar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FA',
  },
  introCard: {
    backgroundColor: '#176B87',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  introTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  introText: { color: '#E7F5F8', fontSize: 16, lineHeight: 23, marginTop: 8 },
  message: { borderRadius: 12, padding: 14, marginBottom: 16 },
  success: { backgroundColor: '#E6F6ED' },
  error: { backgroundColor: '#FDECEC' },
  successText: { color: '#1E6B42', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  centerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  loadingText: { color: '#5F7181', fontSize: 15, marginTop: 12 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9EE',
    borderRadius: 18,
    padding: 34,
  },
  emptyTitle: { color: '#14324A', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#5F7181', fontSize: 15, lineHeight: 21, marginTop: 7, textAlign: 'center' },
  list: { gap: 14 },
  countText: { color: '#5F7181', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9EE',
    borderRadius: 17,
    padding: 20,
    gap: 18,
  },
  requestInfo: { gap: 5 },
  pendingLabel: { color: '#9A6700', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  email: { color: '#14324A', fontSize: 18, fontWeight: '800' },
  date: { color: '#6C7F8F', fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  rejectButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D05A5A',
    borderRadius: 11,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  rejectText: { color: '#B42318', fontSize: 15, fontWeight: '800' },
  approveButton: {
    minWidth: 112,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 18,
    backgroundColor: '#176B87',
  },
  approveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.55 },
});
