import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';

type Client = {
  id: number;
  id_login: number;
  nombre: string;
  apellido: string;
  correo: string;
  fecha: string;
  estado: 'activo' | 'inactivo';
  compras: number;
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

  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ClientsScreen() {
  const db = useSQLiteContext();
  const { user, loading: authLoading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const isAdmin = user?.rol === 'admin';

  const loadClients = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);

      const sql = `
        SELECT
          c.id,
          c.id_login,
          c.nombre,
          c.apellido,
          c.correo,
          c.fecha,
          l.estado,
          COUNT(e.id) AS compras
        FROM Cliente c
        INNER JOIN Login l ON l.id = c.id_login
        LEFT JOIN Encabezado e ON e.id_cliente = c.id
        ${isAdmin ? '' : 'WHERE c.id_login = ?'}
        GROUP BY c.id, c.id_login, c.nombre, c.apellido, c.correo, c.fecha, l.estado
        ORDER BY c.nombre COLLATE NOCASE, c.apellido COLLATE NOCASE
      `;

      const rows = isAdmin
        ? await db.getAllAsync<Client>(sql)
        : await db.getAllAsync<Client>(sql, user.id);

      if (!isAdmin && rows.length === 0) {
        router.replace('/perfil');
        return;
      }

      setClients(rows);
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar la información de clientes.' });
    } finally {
      setLoading(false);
    }
  }, [db, isAdmin, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadClients();
      }
    }, [loadClients, user])
  );

  function startEditing(client: Client) {
    setEditingId(client.id);
    setEditName(client.nombre);
    setEditLastName(client.apellido);
    setDeleteId(null);
    setMessage(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName('');
    setEditLastName('');
  }

  async function saveClient(client: Client) {
    const cleanName = editName.trim();
    const cleanLastName = editLastName.trim();

    if (!isAdmin) {
      return;
    }

    if (cleanName.length < 2 || cleanLastName.length < 2) {
      setMessage({ type: 'error', text: 'Escribe un nombre y un apellido válidos.' });
      return;
    }

    try {
      setProcessingId(client.id);
      setMessage(null);

      await db.runAsync(
        'UPDATE Cliente SET nombre = ?, apellido = ? WHERE id = ?',
        cleanName,
        cleanLastName,
        client.id
      );

      cancelEditing();
      setMessage({ type: 'success', text: 'Los datos del cliente fueron actualizados.' });
      await loadClients();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible actualizar el cliente.' });
    } finally {
      setProcessingId(null);
    }
  }

  async function changeStatus(client: Client) {
    if (!isAdmin) {
      return;
    }

    const newStatus = client.estado === 'activo' ? 'inactivo' : 'activo';

    try {
      setProcessingId(client.id);
      setMessage(null);
      setDeleteId(null);

      await db.runAsync(
        "UPDATE Login SET estado = ? WHERE id = ? AND rol = 'cliente'",
        newStatus,
        client.id_login
      );

      setMessage({
        type: 'success',
        text:
          newStatus === 'activo'
            ? `La cuenta de ${client.correo} fue activada.`
            : `La cuenta de ${client.correo} fue inactivada.`,
      });
      await loadClients();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cambiar el estado del cliente.' });
    } finally {
      setProcessingId(null);
    }
  }

  function requestDelete(client: Client) {
    setMessage(null);
    cancelEditing();

    if (client.compras > 0) {
      setDeleteId(null);
      setMessage({
        type: 'error',
        text: `${client.nombre} tiene compras registradas. Para conservar el historial, solo puedes inactivar su cuenta.`,
      });
      return;
    }

    setDeleteId(client.id);
  }

  async function deleteClient(client: Client) {
    if (!isAdmin) {
      return;
    }

    try {
      setProcessingId(client.id);
      setMessage(null);

      const purchase = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM Encabezado WHERE id_cliente = ? LIMIT 1',
        client.id
      );

      if (purchase) {
        setDeleteId(null);
        setMessage({
          type: 'error',
          text: 'El cliente ya tiene compras. Puedes inactivarlo, pero no eliminar su historial.',
        });
        await loadClients();
        return;
      }

      await db.runAsync(
        "DELETE FROM Login WHERE id = ? AND rol = 'cliente'",
        client.id_login
      );

      setDeleteId(null);
      setMessage({ type: 'success', text: 'El cliente y su cuenta fueron eliminados.' });
      await loadClients();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible eliminar el cliente.' });
    } finally {
      setProcessingId(null);
    }
  }

  if (authLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{isAdmin ? 'Clientes registrados' : 'Mi perfil'}</Text>
          <Text style={styles.introText}>
            {isAdmin
              ? 'Consulta, edita, inactiva o elimina clientes sin perder el historial de compras.'
              : 'Consulta los datos asociados a tu cuenta de cliente.'}
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
            <Text style={styles.loadingText}>Cargando clientes...</Text>
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay clientes registrados</Text>
            <Text style={styles.emptyText}>
              Los usuarios aparecerán aquí después de completar su perfil.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {isAdmin ? (
              <Text style={styles.countText}>
                {clients.length} {clients.length === 1 ? 'cliente registrado' : 'clientes registrados'}
              </Text>
            ) : null}

            {clients.map((client) => {
              const isEditing = editingId === client.id;
              const isDeleting = deleteId === client.id;
              const isProcessing = processingId === client.id;

              return (
                <View key={client.id} style={styles.clientCard}>
                  <View style={styles.clientHeader}>
                    <View style={styles.clientInfo}>
                      <Text
                        style={[
                          styles.statusLabel,
                          client.estado === 'activo' ? styles.activeText : styles.inactiveText,
                        ]}>
                        {client.estado.toUpperCase()}
                      </Text>
                      <Text style={styles.clientName}>
                        {client.nombre} {client.apellido}
                      </Text>
                      <Text style={styles.email}>{client.correo}</Text>
                    </View>
                    <View style={styles.purchaseBadge}>
                      <Text style={styles.purchaseNumber}>{client.compras}</Text>
                      <Text style={styles.purchaseText}>
                        {client.compras === 1 ? 'compra' : 'compras'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.date}>Cliente desde: {formatDate(client.fecha)}</Text>

                  {isEditing ? (
                    <View style={styles.editForm}>
                      <Text style={styles.label}>Nombre</Text>
                      <TextInput
                        style={styles.input}
                        value={editName}
                        onChangeText={setEditName}
                        autoCapitalize="words"
                        editable={!isProcessing}
                      />
                      <Text style={styles.label}>Apellido</Text>
                      <TextInput
                        style={styles.input}
                        value={editLastName}
                        onChangeText={setEditLastName}
                        autoCapitalize="words"
                        editable={!isProcessing}
                      />
                      <View style={styles.actions}>
                        <Pressable style={styles.secondaryButton} onPress={cancelEditing}>
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.primaryButton}
                          onPress={() => saveClient(client)}
                          disabled={isProcessing}>
                          {isProcessing ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.primaryButtonText}>Guardar</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {isDeleting ? (
                    <View style={styles.deleteConfirmation}>
                      <Text style={styles.confirmTitle}>¿Eliminar definitivamente?</Text>
                      <Text style={styles.confirmText}>
                        Se eliminarán el cliente y su cuenta de acceso. Esta acción no se puede deshacer.
                      </Text>
                      <View style={styles.actions}>
                        <Pressable style={styles.secondaryButton} onPress={() => setDeleteId(null)}>
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.deleteConfirmButton}
                          onPress={() => deleteClient(client)}
                          disabled={isProcessing}>
                          {isProcessing ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.deleteConfirmText}>Sí, eliminar</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {isAdmin && !isEditing && !isDeleting ? (
                    <View style={styles.actionsWrap}>
                      <Pressable style={styles.secondaryButton} onPress={() => startEditing(client)}>
                        <Text style={styles.secondaryButtonText}>Editar</Text>
                      </Pressable>
                      <Pressable style={styles.statusButton} onPress={() => changeStatus(client)}>
                        <Text style={styles.statusButtonText}>
                          {client.estado === 'activo' ? 'Inactivar' : 'Activar'}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.deleteButton} onPress={() => requestDelete(client)}>
                        <Text style={styles.deleteButtonText}>Eliminar</Text>
                      </Pressable>
                    </View>
                  ) : null}
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
    maxWidth: 860,
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
  introCard: { backgroundColor: '#176B87', borderRadius: 20, padding: 24, marginBottom: 20 },
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
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9EE',
    borderRadius: 17,
    padding: 20,
    gap: 14,
  },
  clientHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  clientInfo: { flex: 1, gap: 4 },
  statusLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  activeText: { color: '#1E6B42' },
  inactiveText: { color: '#B42318' },
  clientName: { color: '#14324A', fontSize: 20, fontWeight: '900' },
  email: { color: '#5F7181', fontSize: 15 },
  purchaseBadge: { alignItems: 'center', backgroundColor: '#EDF6F8', borderRadius: 12, padding: 10 },
  purchaseNumber: { color: '#176B87', fontSize: 19, fontWeight: '900' },
  purchaseText: { color: '#5F7181', fontSize: 12 },
  date: { color: '#6C7F8F', fontSize: 14 },
  editForm: { borderTopWidth: 1, borderTopColor: '#E2E9EE', paddingTop: 15 },
  label: { color: '#14324A', fontSize: 14, fontWeight: '800', marginBottom: 7 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D8E1E8',
    borderRadius: 11,
    paddingHorizontal: 13,
    color: '#14324A',
    backgroundColor: '#FAFCFD',
    fontSize: 16,
    marginBottom: 14,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  actionsWrap: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  primaryButton: {
    minWidth: 105,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#176B87',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#AAC1CE',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: { color: '#176B87', fontSize: 14, fontWeight: '800' },
  statusButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C19B3A',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFF9E8',
  },
  statusButtonText: { color: '#7A5A00', fontSize: 14, fontWeight: '800' },
  deleteButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D05A5A',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  deleteButtonText: { color: '#B42318', fontSize: 14, fontWeight: '800' },
  deleteConfirmation: { backgroundColor: '#FFF1F0', borderRadius: 12, padding: 15 },
  confirmTitle: { color: '#8F1D14', fontSize: 16, fontWeight: '900' },
  confirmText: { color: '#8F1D14', fontSize: 14, lineHeight: 20, marginTop: 5 },
  deleteConfirmButton: {
    minWidth: 112,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#B42318',
  },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
