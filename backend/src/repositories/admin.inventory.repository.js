// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN INVENTORY REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const listVariantsWithProduct = async ({ offset, limit, lowStockOnly }) => {
  const conditions = [];
  const params = [];

  if (lowStockOnly) {
    conditions.push('pv.stockQuantity <= pv.lowStockThreshold');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT pv.id, pv.sku, pv.attributes, pv.stockQuantity, pv.lowStockThreshold,
            pv.price, pv.isActive, p.id AS productId, p.name AS productName
       FROM product_variants pv
       JOIN products p ON p.id = pv.productId
      ${whereClause}
      ORDER BY pv.stockQuantity ASC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countVariants = async ({ lowStockOnly }) => {
  const conditions = [];

  if (lowStockOnly) {
    conditions.push('stockQuantity <= lowStockThreshold');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executeOne(
    `SELECT COUNT(*) AS total FROM product_variants ${whereClause}`
  );
};

export const getProductWithVariants = async (productId) => {
  const product = await executeOne(
    `SELECT id, name FROM products WHERE id = ?`,
    [productId]
  );

  if (!product) return null;

  const variants = await execute(
    `SELECT id, sku, attributes, stockQuantity, lowStockThreshold, price
       FROM product_variants
      WHERE productId = ?`,
    [productId]
  );

  return { ...product, variants };
};

export const getVariantWithProduct = async (variantId) =>
  executeOne(
    `SELECT pv.id, pv.sku, pv.attributes, pv.stockQuantity, pv.lowStockThreshold, pv.price,
            p.name AS productName
       FROM product_variants pv
       JOIN products p ON p.id = pv.productId
      WHERE pv.id = ?`,
    [variantId]
  );

export const listStockMovements = async ({ variantId, type, startDate, endDate, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (variantId) {
    conditions.push('sm.variantId = ?');
    params.push(variantId);
  }
  if (type) {
    conditions.push('sm.type = ?');
    params.push(type);
  }
  if (startDate) {
    conditions.push('sm.performedAt >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('sm.performedAt <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT sm.*, pv.sku, p.name AS productName
       FROM stock_movements sm
       JOIN product_variants pv ON pv.id = sm.variantId
       JOIN products p ON p.id = pv.productId
      ${whereClause}
      ORDER BY sm.performedAt DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countStockMovements = async ({ variantId, type, startDate, endDate }) => {
  const conditions = [];
  const params = [];

  if (variantId) {
    conditions.push('variantId = ?');
    params.push(variantId);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (startDate) {
    conditions.push('performedAt >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('performedAt <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executeOne(
    `SELECT COUNT(*) AS total FROM stock_movements ${whereClause}`,
    params
  );
};

export const listVarianceReport = async ({ limit, offset }) =>
  execute(
    `SELECT pv.id, pv.sku, pv.attributes, pv.stockQuantity, pv.lowStockThreshold,
            p.name AS productName
       FROM product_variants pv
       JOIN products p ON p.id = pv.productId
      WHERE pv.stockQuantity <= 0
      ORDER BY pv.stockQuantity ASC
      LIMIT ? OFFSET ?`,
    [limit, offset]
  );

export const countVarianceReport = async () =>
  executeOne(
    `SELECT COUNT(*) AS total FROM product_variants WHERE stockQuantity <= 0`
  );

export const createStockAdjustment = async (connection, data) => {
  const { id, variantId, adjustment, reason, notes, status, requestedBy } = data;
  return execute(
    `INSERT INTO stock_adjustments
        (id, variantId, adjustment, reason, notes, status, requestedBy, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, variantId, adjustment, reason, notes || null, status, requestedBy],
    connection
  );
};

export const getStockAdjustmentById = async (connection, adjustmentId) =>
  executeOne(
    `SELECT * FROM stock_adjustments WHERE id = ?`,
    [adjustmentId],
    connection
  );

export const updateStockAdjustment = async (connection, adjustmentId, data) => {
  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  values.push(adjustmentId);

  await execute(
    `UPDATE stock_adjustments SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values,
    connection
  );
};

export const insertAdminActionLog = async (adminId, action, metadata) =>
  execute(
    `INSERT INTO admin_action_log
        (id, adminId, action, metadata, createdAt)
     VALUES (UUID(), ?, ?, ?, NOW())`,
    [adminId, action, metadata || null]
  );

export const updateVariantThreshold = async (variantId, threshold) =>
  execute(
    `UPDATE product_variants
        SET lowStockThreshold = ?, updatedAt = NOW()
      WHERE id = ?`,
    [threshold, variantId]
  );
