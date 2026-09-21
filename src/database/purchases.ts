import type { SQLiteDatabase } from 'expo-sqlite';

export type PurchaseItemInput = {
  productId: number;
  quantity: number;
};

type ProductRow = {
  id: number;
  nombre: string;
  valor_unitario: number;
  stock: number;
};

type DetailRow = {
  id: number;
  id_encabezado: number;
  id_producto: number;
  cantidad: number;
  valor: number;
  stock: number;
};

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

export async function createPurchase(
  db: SQLiteDatabase,
  clientId: number,
  items: PurchaseItemInput[]
) {
  let purchaseId = 0;

  await db.withTransactionAsync(async () => {
    if (items.length === 0) {
      throw new Error('Selecciona al menos un producto.');
    }

    const selectedProducts: Array<ProductRow & { quantity: number }> = [];
    let total = 0;

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error('Las cantidades deben ser números enteros mayores que cero.');
      }

      const product = await db.getFirstAsync<ProductRow>(
        'SELECT id, nombre, valor_unitario, stock FROM Producto WHERE id = ?',
        item.productId
      );

      if (!product) {
        throw new Error('Uno de los productos ya no existe.');
      }

      if (product.stock < item.quantity) {
        throw new Error(`No hay suficiente stock de ${product.nombre}. Disponible: ${product.stock}.`);
      }

      selectedProducts.push({ ...product, quantity: item.quantity });
      total += product.valor_unitario * item.quantity;
    }

    const header = await db.runAsync(
      'INSERT INTO Encabezado (id_cliente, total) VALUES (?, ?)',
      clientId,
      total
    );
    purchaseId = header.lastInsertRowId;

    for (const product of selectedProducts) {
      const stockUpdate = await db.runAsync(
        'UPDATE Producto SET stock = stock - ? WHERE id = ? AND stock >= ?',
        product.quantity,
        product.id,
        product.quantity
      );

      if (stockUpdate.changes === 0) {
        throw new Error(`El stock de ${product.nombre} cambió. Intenta nuevamente.`);
      }

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

  return purchaseId;
}

export async function deletePurchase(db: SQLiteDatabase, purchaseId: number) {
  await db.withTransactionAsync(async () => {
    const details = await db.getAllAsync<{ id_producto: number; cantidad: number }>(
      'SELECT id_producto, cantidad FROM Detalles WHERE id_encabezado = ?',
      purchaseId
    );

    for (const detail of details) {
      await db.runAsync(
        'UPDATE Producto SET stock = stock + ? WHERE id = ?',
        detail.cantidad,
        detail.id_producto
      );
    }

    await db.runAsync('DELETE FROM Encabezado WHERE id = ?', purchaseId);
  });
}

export async function updateDetailQuantity(
  db: SQLiteDatabase,
  detailId: number,
  newQuantity: number
) {
  if (!Number.isInteger(newQuantity) || newQuantity <= 0) {
    throw new Error('La cantidad debe ser un número entero mayor que cero.');
  }

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

    const difference = newQuantity - detail.cantidad;
    const unitPrice = detail.valor / detail.cantidad;

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
      await db.runAsync(
        'UPDATE Producto SET stock = stock + ? WHERE id = ?',
        Math.abs(difference),
        detail.id_producto
      );
    }

    await db.runAsync(
      'UPDATE Detalles SET cantidad = ?, valor = ? WHERE id = ?',
      newQuantity,
      unitPrice * newQuantity,
      detailId
    );
    await recalculateTotal(db, detail.id_encabezado);
  });
}

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
    const existingDetail = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM Detalles WHERE id_encabezado = ? AND id_producto = ?',
      purchaseId,
      productId
    );

    if (existingDetail) {
      throw new Error('Ese producto ya está incluido en la compra. Edita su cantidad.');
    }

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

    const stockUpdate = await db.runAsync(
      'UPDATE Producto SET stock = stock - ? WHERE id = ? AND stock >= ?',
      quantity,
      product.id,
      quantity
    );

    if (stockUpdate.changes === 0) {
      throw new Error(`El stock de ${product.nombre} cambió. Intenta nuevamente.`);
    }

    await db.runAsync(
      `INSERT INTO Detalles (id_encabezado, id_producto, cantidad, valor)
       VALUES (?, ?, ?, ?)`,
      purchaseId,
      product.id,
      quantity,
      product.valor_unitario * quantity
    );
    await recalculateTotal(db, purchaseId);
  });
}

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

    const count = await db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM Detalles WHERE id_encabezado = ?',
      detail.id_encabezado
    );

    if (!count || count.total <= 1) {
      throw new Error('Una compra debe conservar al menos un detalle. Elimina la compra completa.');
    }

    await db.runAsync(
      'UPDATE Producto SET stock = stock + ? WHERE id = ?',
      detail.cantidad,
      detail.id_producto
    );
    await db.runAsync('DELETE FROM Detalles WHERE id = ?', detailId);
    await recalculateTotal(db, detail.id_encabezado);
  });
}
