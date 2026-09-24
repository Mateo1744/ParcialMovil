/**
 * RESUMEN DEL ARCHIVO
 * Implementa el inventario de productos. Todos pueden consultar, pero solo el
 * administrador puede crear, editar o eliminar productos.
 */

// Hooks usados para estados, consultas y recarga al volver a la pantalla.
import { useCallback, useEffect, useState } from 'react';
// Navegación y enfoque de la ruta.
import { router, useFocusEffect } from 'expo-router';
// Conexión SQLite compartida.
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

// Datos de sesión para aplicar permisos por rol.
import { useAuth } from '@/context/auth-context';

// Estructura completa de un producto leído de SQLite.
type Product = {
  id: number;
  nombre: string;
  descripcion: string;
  valor_unitario: number;
  stock: number;
  ventas: number;
};

type Message = {
  type: 'success' | 'error';
  text: string;
};

// Todos los TextInput trabajan con texto, incluso precio y stock.
type ProductForm = {
  nombre: string;
  descripcion: string;
  valor: string;
  stock: string;
};

// Valores usados al abrir o limpiar un formulario.
const EMPTY_FORM: ProductForm = {
  nombre: '',
  descripcion: '',
  valor: '',
  stock: '',
};

// Presenta los valores en pesos colombianos.
function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

// Limpia y convierte los campos del formulario a tipos válidos para SQLite.
function parseProductForm(form: ProductForm) {
  const nombre = form.nombre.trim();
  const descripcion = form.descripcion.trim();
  const valor = Number(form.valor.replace(',', '.'));
  const stock = Number(form.stock);

  if (nombre.length < 2 || descripcion.length < 2) {
    return { ok: false as const, message: 'Escribe un nombre y una descripción válidos.' };
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false as const, message: 'El valor unitario debe ser mayor que cero.' };
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false as const, message: 'El stock debe ser un número entero igual o mayor que cero.' };
  }

  return { ok: true as const, nombre, descripcion, valor, stock };
}

export default function ProductsScreen() {
  // Base de datos y sesión actual.
  const db = useSQLiteContext();
  const { user, loading: authLoading } = useAuth();
  // Lista, carga, formularios y confirmación de eliminación.
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<ProductForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  // Solo este rol verá controles de escritura.
  const isAdmin = user?.rol === 'admin';

  // Consulta productos y cuenta cuántos detalles de compra usan cada uno.
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db.getAllAsync<Product>(`
        SELECT
          p.id,
          p.nombre,
          p.descripcion,
          p.valor_unitario,
          p.stock,
          COUNT(d.id) AS ventas
        FROM Producto p
        LEFT JOIN Detalles d ON d.id_producto = p.id
        GROUP BY p.id, p.nombre, p.descripcion, p.valor_unitario, p.stock
        ORDER BY p.nombre COLLATE NOCASE
      `);
      setProducts(rows);
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar los productos.' });
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Protege la pantalla cuando no hay sesión.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  // Recarga los productos al regresar desde otro módulo.
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadProducts();
      }
    }, [loadProducts, user])
  );

  // Actualiza un campo específico del formulario de creación.
  function changeCreateField(field: keyof ProductForm, value: string) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  // Actualiza un campo específico del formulario de edición.
  function changeEditField(field: keyof ProductForm, value: string) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  // Cierra y reinicia el formulario de creación.
  function closeCreateForm() {
    setShowCreateForm(false);
    setCreateForm(EMPTY_FORM);
  }

  // Valida e inserta un producto nuevo.
  async function createProduct() {
    if (!isAdmin) {
      return;
    }

    const parsed = parseProductForm(createForm);
    if (!parsed.ok) {
      setMessage({ type: 'error', text: parsed.message });
      return;
    }

    try {
      setCreating(true);
      setMessage(null);
      await db.runAsync(
        `INSERT INTO Producto (nombre, descripcion, valor_unitario, stock)
         VALUES (?, ?, ?, ?)`,
        parsed.nombre,
        parsed.descripcion,
        parsed.valor,
        parsed.stock
      );

      closeCreateForm();
      setMessage({ type: 'success', text: 'El producto fue creado correctamente.' });
      await loadProducts();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible crear el producto.' });
    } finally {
      setCreating(false);
    }
  }

  // Copia los valores seleccionados al formulario de edición.
  function startEditing(product: Product) {
    setEditingId(product.id);
    setEditForm({
      nombre: product.nombre,
      descripcion: product.descripcion,
      valor: String(product.valor_unitario),
      stock: String(product.stock),
    });
    setDeleteId(null);
    setMessage(null);
  }

  // Sale del modo edición y limpia los campos.
  function cancelEditing() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  // Valida y guarda los cambios de un producto existente.
  async function updateProduct(product: Product) {
    if (!isAdmin) {
      return;
    }

    const parsed = parseProductForm(editForm);
    if (!parsed.ok) {
      setMessage({ type: 'error', text: parsed.message });
      return;
    }

    try {
      setProcessingId(product.id);
      setMessage(null);
      await db.runAsync(
        `UPDATE Producto
         SET nombre = ?, descripcion = ?, valor_unitario = ?, stock = ?
         WHERE id = ?`,
        parsed.nombre,
        parsed.descripcion,
        parsed.valor,
        parsed.stock,
        product.id
      );

      cancelEditing();
      setMessage({ type: 'success', text: 'El producto fue actualizado correctamente.' });
      await loadProducts();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible actualizar el producto.' });
    } finally {
      setProcessingId(null);
    }
  }

  // Comprueba si se puede mostrar la confirmación de eliminación.
  function requestDelete(product: Product) {
    cancelEditing();
    setMessage(null);

    // Un producto vendido debe conservarse para no romper el historial.
    if (product.ventas > 0) {
      setDeleteId(null);
      setMessage({
        type: 'error',
        text: `${product.nombre} aparece en compras registradas y no se puede eliminar. Puedes dejar su stock en cero.`,
      });
      return;
    }

    setDeleteId(product.id);
  }

  // Elimina el producto después de repetir la validación en la base.
  async function deleteProduct(product: Product) {
    if (!isAdmin) {
      return;
    }

    try {
      setProcessingId(product.id);
      setMessage(null);

      // Revisa de nuevo por si se registró una compra recientemente.
      const sale = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM Detalles WHERE id_producto = ? LIMIT 1',
        product.id
      );

      if (sale) {
        setDeleteId(null);
        setMessage({
          type: 'error',
          text: 'El producto ya tiene compras relacionadas y no puede eliminarse.',
        });
        await loadProducts();
        return;
      }

      await db.runAsync('DELETE FROM Producto WHERE id = ?', product.id);
      setDeleteId(null);
      setMessage({ type: 'success', text: 'El producto fue eliminado.' });
      await loadProducts();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible eliminar el producto.' });
    } finally {
      setProcessingId(null);
    }
  }

  // Evita mostrar el inventario antes de recuperar la sesión.
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
          <View style={styles.introTextContainer}>
            <Text style={styles.introTitle}>{isAdmin ? 'Administrar productos' : 'Productos'}</Text>
            <Text style={styles.introText}>
              {isAdmin
                ? 'Crea y actualiza los productos disponibles y controla sus existencias.'
                : 'Consulta los productos disponibles, sus precios y existencias.'}
            </Text>
          </View>
          {isAdmin ? (
            <Pressable
              style={styles.newButton}
              onPress={() => {
                setShowCreateForm((current) => !current);
                cancelEditing();
                setDeleteId(null);
                setMessage(null);
              }}>
              <Text style={styles.newButtonText}>{showCreateForm ? 'Cerrar' : 'Nuevo producto'}</Text>
            </Pressable>
          ) : null}
        </View>

        {message ? (
          <View style={[styles.message, message.type === 'error' ? styles.error : styles.success]}>
            <Text style={message.type === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          </View>
        ) : null}

        {isAdmin && showCreateForm ? (
          <ProductFormCard
            title="Nuevo producto"
            form={createForm}
            disabled={creating}
            onChange={changeCreateField}
            onCancel={closeCreateForm}
            onSave={createProduct}
            saveLabel="Crear producto"
          />
        ) : null}

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#176B87" />
            <Text style={styles.loadingText}>Cargando productos...</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay productos registrados</Text>
            <Text style={styles.emptyText}>
              {isAdmin
                ? 'Usa el botón “Nuevo producto” para crear el primero.'
                : 'El administrador todavía no ha registrado productos.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.countText}>
              {products.length} {products.length === 1 ? 'producto' : 'productos'}
            </Text>

            {products.map((product) => {
              const isEditing = editingId === product.id;
              const isDeleting = deleteId === product.id;
              const isProcessing = processingId === product.id;

              return (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.nombre}</Text>
                      <Text style={styles.description}>{product.descripcion}</Text>
                    </View>
                    <View style={styles.priceBox}>
                      <Text style={styles.price}>{formatMoney(product.valor_unitario)}</Text>
                      <Text style={[styles.stock, product.stock === 0 && styles.outOfStock]}>
                        {product.stock === 0 ? 'Sin existencias' : `Stock: ${product.stock}`}
                      </Text>
                    </View>
                  </View>

                  {isAdmin ? (
                    <Text style={styles.salesText}>
                      Aparece en {product.ventas} {product.ventas === 1 ? 'detalle de compra' : 'detalles de compra'}
                    </Text>
                  ) : null}

                  {isEditing ? (
                    <ProductFormCard
                      title="Editar producto"
                      form={editForm}
                      disabled={isProcessing}
                      onChange={changeEditField}
                      onCancel={cancelEditing}
                      onSave={() => updateProduct(product)}
                      saveLabel="Guardar cambios"
                      embedded
                    />
                  ) : null}

                  {isDeleting ? (
                    <View style={styles.deleteConfirmation}>
                      <Text style={styles.confirmTitle}>¿Eliminar definitivamente?</Text>
                      <Text style={styles.confirmText}>
                        El producto desaparecerá del catálogo. Esta acción no se puede deshacer.
                      </Text>
                      <View style={styles.actions}>
                        <Pressable style={styles.secondaryButton} onPress={() => setDeleteId(null)}>
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.deleteConfirmButton}
                          onPress={() => deleteProduct(product)}
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
                    <View style={styles.actions}>
                      <Pressable style={styles.secondaryButton} onPress={() => startEditing(product)}>
                        <Text style={styles.secondaryButtonText}>Editar</Text>
                      </Pressable>
                      <Pressable style={styles.deleteButton} onPress={() => requestDelete(product)}>
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

// Propiedades del formulario reutilizado para crear y editar.
type ProductFormCardProps = {
  title: string;
  form: ProductForm;
  disabled: boolean;
  onChange: (field: keyof ProductForm, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  embedded?: boolean;
};

// Componente visual reutilizable para no duplicar todos los campos.
function ProductFormCard({
  title,
  form,
  disabled,
  onChange,
  onCancel,
  onSave,
  saveLabel,
  embedded = false,
}: ProductFormCardProps) {
  return (
    <View style={embedded ? styles.embeddedForm : styles.createCard}>
      <Text style={styles.formTitle}>{title}</Text>
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={form.nombre}
        onChangeText={(value) => onChange('nombre', value)}
        placeholder="Ejemplo: Teclado"
        placeholderTextColor="#8A98A6"
        editable={!disabled}
      />
      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.descriptionInput]}
        value={form.descripcion}
        onChangeText={(value) => onChange('descripcion', value)}
        placeholder="Descripción del producto"
        placeholderTextColor="#8A98A6"
        multiline
        editable={!disabled}
      />
      <View style={styles.formRow}>
        <View style={styles.formColumn}>
          <Text style={styles.label}>Valor unitario</Text>
          <TextInput
            style={styles.input}
            value={form.valor}
            onChangeText={(value) => onChange('valor', value)}
            placeholder="50000"
            placeholderTextColor="#8A98A6"
            keyboardType="decimal-pad"
            editable={!disabled}
          />
        </View>
        <View style={styles.formColumn}>
          <Text style={styles.label}>Stock</Text>
          <TextInput
            style={styles.input}
            value={form.stock}
            onChangeText={(value) => onChange('stock', value)}
            placeholder="10"
            placeholderTextColor="#8A98A6"
            keyboardType="number-pad"
            editable={!disabled}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onCancel} disabled={disabled}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onSave} disabled={disabled}>
          {disabled ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{saveLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// Estilos del inventario y de sus formularios.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 900,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    backgroundColor: '#176B87',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  introTextContainer: { flex: 1 },
  introTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  introText: { color: '#E7F5F8', fontSize: 16, lineHeight: 23, marginTop: 8 },
  newButton: { backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 17, paddingVertical: 13 },
  newButtonText: { color: '#176B87', fontSize: 14, fontWeight: '900' },
  message: { borderRadius: 12, padding: 14, marginBottom: 16 },
  success: { backgroundColor: '#E6F6ED' },
  error: { backgroundColor: '#FDECEC' },
  successText: { color: '#1E6B42', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  createCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFE1E8',
    borderRadius: 17,
    padding: 20,
    marginBottom: 18,
  },
  embeddedForm: { borderTopWidth: 1, borderTopColor: '#E2E9EE', paddingTop: 15 },
  formTitle: { color: '#14324A', fontSize: 19, fontWeight: '900', marginBottom: 16 },
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
  descriptionInput: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  formRow: { flexDirection: 'row', gap: 12 },
  formColumn: { flex: 1 },
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
  productCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9EE',
    borderRadius: 17,
    padding: 20,
    gap: 14,
  },
  productHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  productInfo: { flex: 1 },
  productName: { color: '#14324A', fontSize: 20, fontWeight: '900' },
  description: { color: '#5F7181', fontSize: 15, lineHeight: 21, marginTop: 5 },
  priceBox: { alignItems: 'flex-end' },
  price: { color: '#176B87', fontSize: 18, fontWeight: '900' },
  stock: { color: '#1E6B42', fontSize: 13, fontWeight: '800', marginTop: 5 },
  outOfStock: { color: '#B42318' },
  salesText: { color: '#6C7F8F', fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9, marginTop: 4 },
  primaryButton: {
    minWidth: 120,
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
