import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import {
  addPurchaseDetail,
  deletePurchaseDetail,
  updateDetailQuantity,
} from '@/database/purchases';

type PurchaseHeader = {
  id: number;
  fecha: string;
  total: number;
  nombre: string;
  apellido: string;
  correo: string;
  id_login: number;
};

type PurchaseDetail = {
  id: number;
  id_producto: number;
  nombre: string;
  cantidad: number;
  valor: number;
  stock: number;
};

type AvailableProduct = {
  id: number;
  nombre: string;
  valor_unitario: number;
  stock: number;
};

type Message = {
  type: 'success' | 'error';
  text: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PurchaseDetailsScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const purchaseId = Number(rawId);
  const { user, loading: authLoading } = useAuth();
  const [header, setHeader] = useState<PurchaseHeader | null>(null);
  const [details, setDetails] = useState<PurchaseDetail[]>([]);
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState('1');
  const [message, setMessage] = useState<Message | null>(null);

  const isAdmin = user?.rol === 'admin';

  const loadDetails = useCallback(async () => {
    if (!user || !Number.isInteger(purchaseId) || purchaseId <= 0) {
      if (user) {
        setMessage({ type: 'error', text: 'El número de compra no es válido.' });
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const purchase = await db.getFirstAsync<PurchaseHeader>(
        `SELECT e.id, e.fecha, e.total, c.nombre, c.apellido, c.correo, c.id_login
         FROM Encabezado e
         INNER JOIN Cliente c ON c.id = e.id_cliente
         WHERE e.id = ?`,
        purchaseId
      );

      if (!purchase) {
        setHeader(null);
        setMessage({ type: 'error', text: 'La compra no existe.' });
        return;
      }

      if (!isAdmin && purchase.id_login !== user.id) {
        router.replace('/encabezados');
        return;
      }

      const rows = await db.getAllAsync<PurchaseDetail>(
        `SELECT d.id, d.id_producto, p.nombre, d.cantidad, d.valor, p.stock
         FROM Detalles d
         INNER JOIN Producto p ON p.id = d.id_producto
         WHERE d.id_encabezado = ?
         ORDER BY p.nombre COLLATE NOCASE`,
        purchaseId
      );

      const products = isAdmin
        ? await db.getAllAsync<AvailableProduct>(
            `SELECT p.id, p.nombre, p.valor_unitario, p.stock
             FROM Producto p
             WHERE p.stock > 0
               AND NOT EXISTS (
                 SELECT 1 FROM Detalles d
                 WHERE d.id_encabezado = ? AND d.id_producto = p.id
               )
             ORDER BY p.nombre COLLATE NOCASE`,
            purchaseId
          )
        : [];

      setHeader(purchase);
      setDetails(rows);
      setAvailableProducts(products);
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar los detalles de la compra.' });
    } finally {
      setLoading(false);
    }
  }, [db, isAdmin, purchaseId, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadDetails();
      }
    }, [loadDetails, user])
  );

  function startEditing(detail: PurchaseDetail) {
    setEditingId(detail.id);
    setEditQuantity(String(detail.cantidad));
    setDeleteId(null);
    setShowAddForm(false);
    setMessage(null);
  }

  async function saveQuantity(detail: PurchaseDetail) {
    if (!isAdmin) {
      return;
    }

    try {
      setProcessingId(detail.id);
      setMessage(null);
      await updateDetailQuantity(db, detail.id, Number(editQuantity));
      setEditingId(null);
      setMessage({ type: 'success', text: 'La cantidad y el total fueron actualizados.' });
      await loadDetails();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible actualizar el detalle.',
      });
    } finally {
      setProcessingId(null);
    }
  }

  async function addDetail() {
    if (!isAdmin || !selectedProductId) {
      setMessage({ type: 'error', text: 'Selecciona un producto.' });
      return;
    }

    try {
      setProcessingId(-1);
      setMessage(null);
      await addPurchaseDetail(db, purchaseId, selectedProductId, Number(newQuantity));
      setShowAddForm(false);
      setSelectedProductId(null);
      setNewQuantity('1');
      setMessage({ type: 'success', text: 'El producto fue agregado a la compra.' });
      await loadDetails();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible agregar el detalle.',
      });
    } finally {
      setProcessingId(null);
    }
  }

  async function removeDetail(detail: PurchaseDetail) {
    if (!isAdmin) {
      return;
    }

    try {
      setProcessingId(detail.id);
      setMessage(null);
      await deletePurchaseDetail(db, detail.id);
      setDeleteId(null);
      setMessage({
        type: 'success',
        text: 'El detalle fue eliminado y sus unidades regresaron al stock.',
      });
      await loadDetails();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible eliminar el detalle.',
      });
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
        {loading ? (
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#176B87" />
            <Text style={styles.loadingText}>Cargando detalle...</Text>
          </View>
        ) : header ? (
          <>
            <View style={styles.headerCard}>
              <View style={styles.headerInfo}>
                <Text style={styles.headerLabel}>DETALLE DE LA COMPRA #{header.id}</Text>
                <Text style={styles.clientName}>
                  {header.nombre} {header.apellido}
                </Text>
                {isAdmin ? <Text style={styles.email}>{header.correo}</Text> : null}
                <Text style={styles.date}>{formatDate(header.fecha)}</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <Text style={styles.total}>{formatMoney(header.total)}</Text>
              </View>
            </View>

            {message ? (
              <View style={[styles.message, message.type === 'error' ? styles.error : styles.success]}>
                <Text style={message.type === 'error' ? styles.errorText : styles.successText}>
                  {message.text}
                </Text>
              </View>
            ) : null}

            {isAdmin ? (
              <View style={styles.adminBar}>
                <Text style={styles.adminText}>Edición disponible solo para el administrador</Text>
                <Pressable
                  style={styles.addButton}
                  onPress={() => {
                    setShowAddForm((current) => !current);
                    setEditingId(null);
                    setDeleteId(null);
                    setMessage(null);
                  }}>
                  <Text style={styles.addButtonText}>{showAddForm ? 'Cerrar' : 'Agregar producto'}</Text>
                </Pressable>
              </View>
            ) : null}

            {isAdmin && showAddForm ? (
              <View style={styles.addForm}>
                <Text style={styles.formTitle}>Agregar producto al detalle</Text>
                {availableProducts.length === 0 ? (
                  <Text style={styles.noProductsText}>No hay otros productos con stock disponible.</Text>
                ) : (
                  <>
                    <Text style={styles.label}>Selecciona un producto</Text>
                    <View style={styles.productChoices}>
                      {availableProducts.map((product) => (
                        <Pressable
                          key={product.id}
                          style={[
                            styles.productChoice,
                            selectedProductId === product.id && styles.productChoiceSelected,
                          ]}
                          onPress={() => setSelectedProductId(product.id)}>
                          <Text
                            style={[
                              styles.productChoiceName,
                              selectedProductId === product.id && styles.productChoiceNameSelected,
                            ]}>
                            {product.nombre}
                          </Text>
                          <Text style={styles.productChoiceInfo}>
                            {formatMoney(product.valor_unitario)} · Stock {product.stock}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.label}>Cantidad</Text>
                    <TextInput
                      style={styles.quantityInput}
                      value={newQuantity}
                      onChangeText={setNewQuantity}
                      keyboardType="number-pad"
                      editable={processingId !== -1}
                    />
                    <View style={styles.actions}>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => setShowAddForm(false)}>
                        <Text style={styles.secondaryButtonText}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        style={styles.primaryButton}
                        onPress={addDetail}
                        disabled={processingId === -1}>
                        {processingId === -1 ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Agregar</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            <View style={styles.list}>
              {details.map((detail) => {
                const isEditing = editingId === detail.id;
                const isDeleting = deleteId === detail.id;
                const isProcessing = processingId === detail.id;

                return (
                  <View key={detail.id} style={styles.detailCard}>
                    <View style={styles.detailHeader}>
                      <View style={styles.detailInfo}>
                        <Text style={styles.productName}>{detail.nombre}</Text>
                        <Text style={styles.unitPrice}>
                          Precio unitario: {formatMoney(detail.valor)}
                        </Text>
                      </View>
                      <View style={styles.lineTotalBox}>
                        <Text style={styles.lineTotal}>
                          {formatMoney(detail.cantidad * detail.valor)}
                        </Text>
                        <Text style={styles.quantity}>{detail.cantidad} unidades</Text>
                      </View>
                    </View>

                    {isEditing ? (
                      <View style={styles.editForm}>
                        <Text style={styles.label}>
                          Nueva cantidad (disponibles para agregar: {detail.stock})
                        </Text>
                        <TextInput
                          style={styles.quantityInput}
                          value={editQuantity}
                          onChangeText={setEditQuantity}
                          keyboardType="number-pad"
                          editable={!isProcessing}
                        />
                        <View style={styles.actions}>
                          <Pressable style={styles.secondaryButton} onPress={() => setEditingId(null)}>
                            <Text style={styles.secondaryButtonText}>Cancelar</Text>
                          </Pressable>
                          <Pressable
                            style={styles.primaryButton}
                            onPress={() => saveQuantity(detail)}
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
                        <Text style={styles.confirmTitle}>¿Quitar este producto?</Text>
                        <Text style={styles.confirmText}>Las unidades volverán al stock.</Text>
                        <View style={styles.actions}>
                          <Pressable style={styles.secondaryButton} onPress={() => setDeleteId(null)}>
                            <Text style={styles.secondaryButtonText}>Cancelar</Text>
                          </Pressable>
                          <Pressable
                            style={styles.deleteConfirmButton}
                            onPress={() => removeDetail(detail)}
                            disabled={isProcessing}>
                            {isProcessing ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text style={styles.deleteConfirmText}>Sí, quitar</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    {isAdmin && !isEditing && !isDeleting ? (
                      <View style={styles.actions}>
                        <Pressable style={styles.secondaryButton} onPress={() => startEditing(detail)}>
                          <Text style={styles.secondaryButtonText}>Editar cantidad</Text>
                        </Pressable>
                        <Pressable style={styles.deleteButton} onPress={() => setDeleteId(detail.id)}>
                          <Text style={styles.deleteButtonText}>Quitar</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Compra no disponible</Text>
            <Text style={styles.emptyText}>Regresa a Encabezado y selecciona otra compra.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', padding: 24 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FA' },
  loadingContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { color: '#5F7181', fontSize: 15, marginTop: 12 },
  headerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, backgroundColor: '#176B87', borderRadius: 20, padding: 24, marginBottom: 18 },
  headerInfo: { flex: 1, gap: 4 },
  headerLabel: { color: '#B8E3EF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  clientName: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  email: { color: '#E7F5F8', fontSize: 14 },
  date: { color: '#E7F5F8', fontSize: 14 },
  totalBox: { alignItems: 'flex-end' },
  totalLabel: { color: '#B8E3EF', fontSize: 12, fontWeight: '900' },
  total: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 4 },
  message: { borderRadius: 12, padding: 14, marginBottom: 16 },
  success: { backgroundColor: '#E6F6ED' },
  error: { backgroundColor: '#FDECEC' },
  successText: { color: '#1E6B42', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  adminBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 15 },
  adminText: { flex: 1, color: '#5F7181', fontSize: 14 },
  addButton: { backgroundColor: '#176B87', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12 },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  addForm: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE1E8', borderRadius: 16, padding: 19, marginBottom: 16 },
  formTitle: { color: '#14324A', fontSize: 18, fontWeight: '900', marginBottom: 14 },
  noProductsText: { color: '#5F7181', fontSize: 15 },
  label: { color: '#14324A', fontSize: 14, fontWeight: '800', marginBottom: 7 },
  productChoices: { gap: 8, marginBottom: 14 },
  productChoice: { borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 11, padding: 12, backgroundColor: '#FAFCFD' },
  productChoiceSelected: { borderColor: '#176B87', backgroundColor: '#E8F3F6' },
  productChoiceName: { color: '#14324A', fontSize: 15, fontWeight: '800' },
  productChoiceNameSelected: { color: '#176B87' },
  productChoiceInfo: { color: '#5F7181', fontSize: 13, marginTop: 3 },
  quantityInput: { width: 130, minHeight: 47, borderWidth: 1, borderColor: '#AAC1CE', borderRadius: 10, paddingHorizontal: 13, color: '#14324A', backgroundColor: '#FAFCFD', fontSize: 16, marginBottom: 10 },
  list: { gap: 12 },
  detailCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9EE', borderRadius: 16, padding: 19, gap: 14 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 15 },
  detailInfo: { flex: 1 },
  productName: { color: '#14324A', fontSize: 19, fontWeight: '900' },
  unitPrice: { color: '#5F7181', fontSize: 14, marginTop: 5 },
  lineTotalBox: { alignItems: 'flex-end' },
  lineTotal: { color: '#176B87', fontSize: 18, fontWeight: '900' },
  quantity: { color: '#5F7181', fontSize: 13, marginTop: 4 },
  editForm: { borderTopWidth: 1, borderTopColor: '#E2E9EE', paddingTop: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  primaryButton: { minWidth: 105, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#176B87' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#AAC1CE', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#176B87', fontSize: 14, fontWeight: '800' },
  deleteButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D05A5A', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  deleteButtonText: { color: '#B42318', fontSize: 14, fontWeight: '800' },
  deleteConfirmation: { backgroundColor: '#FFF1F0', borderRadius: 12, padding: 15 },
  confirmTitle: { color: '#8F1D14', fontSize: 16, fontWeight: '900' },
  confirmText: { color: '#8F1D14', fontSize: 14, marginTop: 5 },
  deleteConfirmButton: { minWidth: 105, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#B42318' },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9EE', borderRadius: 18, padding: 34 },
  emptyTitle: { color: '#14324A', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#5F7181', fontSize: 15, lineHeight: 21, marginTop: 7, textAlign: 'center' },
});
