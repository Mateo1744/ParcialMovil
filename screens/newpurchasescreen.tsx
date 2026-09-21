import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
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
import { createPurchase } from '@/database/purchases';

type Product = {
  id: number;
  nombre: string;
  descripcion: string;
  valor_unitario: number;
  stock: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function NewPurchaseScreen() {
  const db = useSQLiteContext();
  const { user, loading: authLoading } = useAuth();
  const [clientId, setClientId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      if (authLoading) {
        return;
      }

      if (!user) {
        router.replace('/login');
        return;
      }

      if (user.rol !== 'cliente') {
        router.replace('/encabezados');
        return;
      }

      try {
        const client = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM Cliente WHERE id_login = ?',
          user.id
        );

        if (!client) {
          router.replace('/perfil');
          return;
        }

        const rows = await db.getAllAsync<Product>(`
          SELECT id, nombre, descripcion, valor_unitario, stock
          FROM Producto
          WHERE stock > 0
          ORDER BY nombre COLLATE NOCASE
        `);

        if (isActive) {
          setClientId(client.id);
          setProducts(rows);
        }
      } catch {
        if (isActive) {
          setError('No fue posible cargar los productos disponibles.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isActive = false;
    };
  }, [authLoading, db, user]);

  const selectedItems = useMemo(
    () =>
      products
        .map((product) => ({
          product,
          quantity: Number(quantities[product.id] ?? 0),
        }))
        .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0),
    [products, quantities]
  );

  const total = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + item.product.valor_unitario * item.quantity,
        0
      ),
    [selectedItems]
  );

  async function handlePurchase() {
    setError('');

    if (!clientId) {
      setError('No se encontró el perfil del cliente.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Selecciona al menos un producto e indica su cantidad.');
      return;
    }

    const invalidQuantity = selectedItems.find(
      (item) => item.quantity > item.product.stock
    );
    if (invalidQuantity) {
      setError(
        `La cantidad de ${invalidQuantity.product.nombre} supera el stock disponible.`
      );
      return;
    }

    try {
      setSaving(true);
      const purchaseId = await createPurchase(
        db,
        clientId,
        selectedItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        }))
      );

      router.replace({ pathname: '/detalles', params: { id: String(purchaseId) } });
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : 'No fue posible registrar la compra.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading || !user || user.rol !== 'cliente') {
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
          <Text style={styles.introTitle}>Nueva compra</Text>
          <Text style={styles.introText}>
            Escribe la cantidad de cada producto que deseas comprar.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay productos con stock</Text>
            <Text style={styles.emptyText}>Intenta nuevamente cuando haya productos disponibles.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {products.map((product) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.nombre}</Text>
                  <Text style={styles.description}>{product.descripcion}</Text>
                  <Text style={styles.price}>{formatMoney(product.valor_unitario)}</Text>
                  <Text style={styles.stock}>Disponibles: {product.stock}</Text>
                </View>
                <View style={styles.quantityBox}>
                  <Text style={styles.quantityLabel}>Cantidad</Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantities[product.id] ?? ''}
                    onChangeText={(value) =>
                      setQuantities((current) => ({ ...current, [product.id]: value }))
                    }
                    placeholder="0"
                    placeholderTextColor="#8A98A6"
                    keyboardType="number-pad"
                    editable={!saving}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL DE LA COMPRA</Text>
            <Text style={styles.summaryUnits}>
              {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} unidades
            </Text>
          </View>
          <Text style={styles.summaryTotal}>{formatMoney(total)}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.purchaseButton,
            pressed && styles.buttonPressed,
            (saving || products.length === 0) && styles.buttonDisabled,
          ]}
          onPress={handlePurchase}
          disabled={saving || products.length === 0}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.purchaseButtonText}>Finalizar compra</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: { flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center', padding: 24 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FA' },
  introCard: { backgroundColor: '#176B87', borderRadius: 20, padding: 24, marginBottom: 20 },
  introTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  introText: { color: '#E7F5F8', fontSize: 16, lineHeight: 23, marginTop: 8 },
  errorText: { color: '#B42318', backgroundColor: '#FFF1F0', borderRadius: 11, padding: 14, lineHeight: 20, marginBottom: 16 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9EE', borderRadius: 18, padding: 34 },
  emptyTitle: { color: '#14324A', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#5F7181', fontSize: 15, lineHeight: 21, marginTop: 7, textAlign: 'center' },
  list: { gap: 12 },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9EE', borderRadius: 16, padding: 18 },
  productInfo: { flex: 1 },
  productName: { color: '#14324A', fontSize: 18, fontWeight: '900' },
  description: { color: '#5F7181', fontSize: 14, lineHeight: 20, marginTop: 4 },
  price: { color: '#176B87', fontSize: 16, fontWeight: '900', marginTop: 8 },
  stock: { color: '#1E6B42', fontSize: 13, fontWeight: '700', marginTop: 3 },
  quantityBox: { width: 92 },
  quantityLabel: { color: '#14324A', fontSize: 12, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  quantityInput: { minHeight: 48, borderWidth: 1, borderColor: '#AAC1CE', borderRadius: 10, color: '#14324A', backgroundColor: '#FAFCFD', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15, backgroundColor: '#E8F3F6', borderRadius: 16, padding: 20, marginTop: 20 },
  summaryLabel: { color: '#176B87', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  summaryUnits: { color: '#5F7181', fontSize: 14, marginTop: 4 },
  summaryTotal: { color: '#14324A', fontSize: 23, fontWeight: '900' },
  purchaseButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#176B87', marginTop: 15 },
  purchaseButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.55 },
});
