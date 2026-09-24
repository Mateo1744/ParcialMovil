/**
 * RESUMEN DEL ARCHIVO
 * Contiene las operaciones de compra que deben modificar varias tablas a la vez.
 * Usa transacciones para mantener sincronizados encabezados, detalles y existencias.
 */

// Tipo de la conexión compartida de expo-sqlite.
import type { SQLiteDatabase } from 'expo-sqlite';

// Datos mínimos que recibe la función al crear una compra.
export type PurchaseItemInput = {
  productId: number;
  quantity: number;
};

// Forma de un producto consultado desde SQLite.
type ProductRow = {
  id: number;
  nombre: string;
  valor_unitario: number;
  stock: number;
};

// Forma de un detalle unido con el stock actual de su producto.
type DetailRow = {
  id: number;
  id_encabezado: number;
  id_producto: number;
  cantidad: number;
  valor: number;
  stock: number;
};

// Suma los subtotales de los detalles y actualiza el total del encabezado.
async function recalculateTotal(db: SQLiteDatabase, purchaseId: number) {
  await db.runAsync(
    `UPDATE Encabezado
     SET total = COALESCE((
       SELECT SUM(valor)
       FROM Detalles
       WHERE id_encabezado = ?
     ), 0)
     WHERE id = ?`,
    purchaseId,
    purchaseId
  );
}

// Crea una compra completa y descuenta las cantidades del inventario.
export async function createPurchase(
  db: SQLiteDatabase,
  clientId: number,
  items: PurchaseItemInput[]
) {
  // Guarda el identificador que SQLite asignará al nuevo encabezado.
  let purchaseId = 0;

  // Si cualquier paso falla, SQLite deshace toda la compra.
  await db.withTransactionAsync(async () => {
    // Una compra debe contener al menos un producto.
    if (items.length === 0) {
      throw new Error('Selecciona al menos un producto.');
    }

    // Aquí se conservan los productos ya validados con su cantidad solicitada.
    const selectedProducts: Array<ProductRow & { quantity: number }> = [];
    // Acumula el valor total antes de crear el encabezado.
    let total = 0;

    // Revisa uno por uno todos los productos recibidos.
    for (const item of items) {
      // Solo acepta cantidades enteras positivas.
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error('Las cantidades deben ser números enteros mayores que cero.');
      }

      // Obtiene precio y existencias actualizadas directamente de la base.
      const product = await db.getFirstAsync<ProductRow>(
        'SELECT id, nombre, valor_unitario, stock FROM Producto WHERE id = ?',
        item.productId
      );

      // Evita comprar un producto eliminado mientras se llenaba el formulario.
      if (!product) {
        throw new Error('Uno de los productos ya no existe.');
      }

      // Detiene la operación si no alcanza el inventario.
      if (product.stock < item.quantity) {
        throw new Error(`No hay suficiente stock de ${product.nombre}. Disponible: ${product.stock}.`);
      }

      // Conserva el producto validado y suma su subtotal.
      selectedProducts.push({ ...product, quantity: item.quantity });
      total += product.valor_unitario * item.quantity;
    }

    // Crea el encabezado con el cliente y el total calculado.
    const header = await db.runAsync(
      'INSERT INTO Encabezado (id_cliente, total) VALUES (?, ?)',
      clientId,
      total
    );
    // Guarda la llave primaria para relacionar todos los detalles.
    purchaseId = header.lastInsertRowId;

    // Registra cada detalle y descuenta su cantidad.
    for (const product of selectedProducts) {
      const stockUpdate = await db.runAsync(
        'UPDATE Producto SET stock = stock - ? WHERE id = ? AND stock >= ?',
        product.quantity,
        product.id,
        product.quantity
      );

      // El WHERE stock >= ? protege contra cambios simultáneos del inventario.
      if (stockUpdate.changes === 0) {
        throw new Error(`El stock de ${product.nombre} cambió. Intenta nuevamente.`);
      }

      // valor guarda el subtotal: precio unitario multiplicado por cantidad.
      await db.runAsync(
        `INSERT INTO Detalles (id_encabezado, id_producto, cantidad, valor)
         VALUES (?, ?, ?, ?)`,
        purchaseId,
        product.id,
        product.quantity,
        product.valor_unitario * product.quantity
      );
    }
  });

  // Devuelve el id para poder abrir inmediatamente el detalle de la compra.
  return purchaseId;
}

// Elimina una compra y devuelve al inventario todos sus productos.
export async function deletePurchase(db: SQLiteDatabase, purchaseId: number) {
  // La devolución y eliminación se comportan como una única operación.
  await db.withTransactionAsync(async () => {
    // Consulta las cantidades que deben volver al inventario.
    const details = await db.getAllAsync<{ id_producto: number; cantidad: number }>(
      'SELECT id_producto, cantidad FROM Detalles WHERE id_encabezado = ?',
      purchaseId
    );

    // Restablece las existencias producto por producto.
    for (const detail of details) {
      await db.runAsync(
        'UPDATE Producto SET stock = stock + ? WHERE id = ?',
        detail.cantidad,
        detail.id_producto
      );
    }

    // Al borrar el encabezado, la regla CASCADE elimina sus detalles.
    await db.runAsync('DELETE FROM Encabezado WHERE id = ?', purchaseId);
  });
}

// Cambia la cantidad de un detalle y compensa la diferencia en el stock.
export async function updateDetailQuantity(
  db: SQLiteDatabase,
  detailId: number,
  newQuantity: number
) {
  // Valida antes de comenzar la transacción.
  if (!Number.isInteger(newQuantity) || newQuantity <= 0) {
    throw new Error('La cantidad debe ser un número entero mayor que cero.');
  }

  await db.withTransactionAsync(async () => {
    // Recupera detalle y producto para conocer cantidad anterior y stock.
    const detail = await db.getFirstAsync<DetailRow>(
      `SELECT d.id, d.id_encabezado, d.id_producto, d.cantidad, d.valor, p.stock
       FROM Detalles d
       INNER JOIN Producto p ON p.id = d.id_producto
       WHERE d.id = ?`,
      detailId
    );

    if (!detail) {
      throw new Error('El detalle ya no existe.');
    }

    // Una diferencia positiva consume stock; una negativa devuelve stock.
    const difference = newQuantity - detail.cantidad;
    // Obtiene el precio unitario a partir del subtotal existente.
    const unitPrice = detail.valor / detail.cantidad;

    // Si aumentó la cantidad, intenta descontar solo la diferencia.
    if (difference > 0) {
      const stockUpdate = await db.runAsync(
        'UPDATE Producto SET stock = stock - ? WHERE id = ? AND stock >= ?',
        difference,
        detail.id_producto,
        difference
      );

      if (stockUpdate.changes === 0) {
        throw new Error(`No hay suficiente stock. Disponible para agregar: ${detail.stock}.`);
      }
    } else if (difference < 0) {
      // Si disminuyó, devuelve la diferencia absoluta al producto.
      await db.runAsync(
        'UPDATE Producto SET stock = stock + ? WHERE id = ?',
        Math.abs(difference),
        detail.id_producto
      );
    }

    // Guarda la nueva cantidad y vuelve a calcular su subtotal.
    await db.runAsync(
      'UPDATE Detalles SET cantidad = ?, valor = ? WHERE id = ?',
      newQuantity,
      unitPrice * newQuantity,
      detailId
    );
    // Sincroniza el total general del encabezado.
    await recalculateTotal(db, detail.id_encabezado);
  });
}

// Agrega un producto nuevo a una compra ya existente.
export async function addPurchaseDetail(
  db: SQLiteDatabase,
  purchaseId: number,
  productId: number,
  quantity: number
) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('La cantidad debe ser un número entero mayor que cero.');
  }

  await db.withTransactionAsync(async () => {
    // No permite repetir el mismo producto en dos detalles de una compra.
    const existingDetail = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM Detalles WHERE id_encabezado = ? AND id_producto = ?',
      purchaseId,
      productId
    );

    if (existingDetail) {
      throw new Error('Ese producto ya está incluido en la compra. Edita su cantidad.');
    }

    // Consulta el precio y el stock real del producto seleccionado.
    const product = await db.getFirstAsync<ProductRow>(
      'SELECT id, nombre, valor_unitario, stock FROM Producto WHERE id = ?',
      productId
    );

    if (!product) {
      throw new Error('El producto seleccionado ya no existe.');
    }

    if (product.stock < quantity) {
      throw new Error(`No hay suficiente stock de ${product.nombre}. Disponible: ${product.stock}.`);
    }

    // Descuenta la cantidad únicamente si todavía hay existencias suficientes.
    const stockUpdate = await db.runAsync(
      'UPDATE Producto SET stock = stock - ? WHERE id = ? AND stock >= ?',
      quantity,
      product.id,
      quantity
    );

    if (stockUpdate.changes === 0) {
      throw new Error(`El stock de ${product.nombre} cambió. Intenta nuevamente.`);
    }

    // Inserta el detalle con su subtotal.
    await db.runAsync(
      `INSERT INTO Detalles (id_encabezado, id_producto, cantidad, valor)
       VALUES (?, ?, ?, ?)`,
      purchaseId,
      product.id,
      quantity,
      product.valor_unitario * quantity
    );
    // Actualiza el total después de añadir el nuevo detalle.
    await recalculateTotal(db, purchaseId);
  });
}

// Elimina un detalle, devuelve su stock y recalcula el encabezado.
export async function deletePurchaseDetail(db: SQLiteDatabase, detailId: number) {
  await db.withTransactionAsync(async () => {
    const detail = await db.getFirstAsync<DetailRow>(
      `SELECT d.id, d.id_encabezado, d.id_producto, d.cantidad, d.valor, p.stock
       FROM Detalles d
       INNER JOIN Producto p ON p.id = d.id_producto
       WHERE d.id = ?`,
      detailId
    );

    if (!detail) {
      throw new Error('El detalle ya no existe.');
    }

    // Cuenta los detalles para impedir que una compra quede vacía.
    const count = await db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM Detalles WHERE id_encabezado = ?',
      detail.id_encabezado
    );

    if (!count || count.total <= 1) {
      throw new Error('Una compra debe conservar al menos un detalle. Elimina la compra completa.');
    }

    // Devuelve al inventario la cantidad que se había comprado.
    await db.runAsync(
      'UPDATE Producto SET stock = stock + ? WHERE id = ?',
      detail.cantidad,
      detail.id_producto
    );
    // Borra el detalle y sincroniza el total restante.
    await db.runAsync('DELETE FROM Detalles WHERE id = ?', detailId);
    await recalculateTotal(db, detail.id_encabezado);
  });
}
