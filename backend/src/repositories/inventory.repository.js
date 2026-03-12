// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVENTORY REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const getVariantForUpdate = async (connection, variantId) =>
  executeOne(
    `SELECT pv.id, pv.sku, pv.stockQuantity, pv.lowStockThreshold, pv.version, pv.isActive,
            p.name AS productName
       FROM product_variants pv
       JOIN products p ON p.id = pv.productId
      WHERE pv.id = ?
      FOR UPDATE`,
    [variantId],
    connection
  );

export const getVariantById = async (variantId) =>
  executeOne(
    `SELECT pv.id, pv.sku, pv.stockQuantity, pv.lowStockThreshold, pv.version, pv.isActive,
            p.name AS productName, p.status AS productStatus
       FROM product_variants pv
       JOIN products p ON p.id = pv.productId
      WHERE pv.id = ?`,
    [variantId]
  );

export const decrementStock = async (connection, variantId, quantity) =>
  execute(
    `UPDATE product_variants
        SET stockQuantity = stockQuantity - ?,
            version = version + 1,
            updatedAt = NOW()
      WHERE id = ?
        AND stockQuantity >= ?`,
    [quantity, variantId, quantity],
    connection
  );

export const incrementStock = async (connection, variantId, quantity) =>
  execute(
    `UPDATE product_variants
        SET stockQuantity = stockQuantity + ?,
            version = version + 1,
            updatedAt = NOW()
      WHERE id = ?`,
    [quantity, variantId],
    connection
  );

export const setStock = async (connection, variantId, newQuantity) =>
  execute(
    `UPDATE product_variants
        SET stockQuantity = ?,
            version = version + 1,
            updatedAt = NOW()
      WHERE id = ?`,
    [newQuantity, variantId],
    connection
  );

export const insertStockMovement = async (connection, data) => {
  const {
    variantId,
    type,
    quantityChange,
    previousQuantity,
    newQuantity,
    orderId,
    purchaseOrderId,
    reason,
    notes,
    performedById,
  } = data;

  return execute(
    `INSERT INTO stock_movements
        (id, variantId, type, quantityChange, previousQuantity, newQuantity,
         orderId, purchaseOrderId, reason, notes, performedById, performedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      variantId,
      type,
      quantityChange,
      previousQuantity,
      newQuantity,
      orderId || null,
      purchaseOrderId || null,
      reason || null,
      notes || null,
      performedById || null,
    ],
    connection
  );
};

export const getStockHistory = async (variantId, limit) =>
  execute(
    `SELECT sm.id, sm.type, sm.quantityChange, sm.previousQuantity, sm.newQuantity,
            sm.orderId, sm.purchaseOrderId, sm.reason, sm.notes, sm.performedById,
            sm.performedAt,
            o.orderNumber AS orderNumber,
            po.poNumber AS purchaseOrderNumber
       FROM stock_movements sm
       LEFT JOIN orders o ON o.id = sm.orderId
       LEFT JOIN purchase_orders po ON po.id = sm.purchaseOrderId
      WHERE sm.variantId = ?
      ORDER BY sm.performedAt DESC
      LIMIT ?`,
    [variantId, limit]
  );

export const getLowStockAlerts = async () =>
  execute(
    `SELECT pv.id, pv.sku, pv.stockQuantity, pv.lowStockThreshold, pv.isActive,
            p.name AS productName, p.status AS productStatus
       FROM product_variants pv
       JOIN products p ON p.id = pv.productId
      WHERE pv.isActive = 1
        AND pv.stockQuantity <= pv.lowStockThreshold
      ORDER BY pv.stockQuantity ASC`
  );
