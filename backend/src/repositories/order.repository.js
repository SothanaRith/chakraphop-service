// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORDER REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import crypto from 'node:crypto';
import { execute, executeOne } from '../db/index.js';

export const countOrdersBetween = async (startDate, endDate) =>
  executeOne(
    `SELECT COUNT(*) AS total
       FROM orders
      WHERE createdAt >= ? AND createdAt <= ?`,
    [startDate, endDate]
  );

export const insertOrder = async (connection, data) => {
  const {
    id,
    orderNumber,
    userId,
    status,
    subtotal,
    tax,
    shippingCost,
    discount,
    total,
    shippingAddressId,
    customerNotes,
  } = data;

  await execute(
    `INSERT INTO orders
        (id, orderNumber, userId, status, subtotal, tax, shippingCost, discount, total,
         shippingAddressId, customerNotes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      orderNumber,
      userId,
      status,
      subtotal,
      tax,
      shippingCost,
      discount,
      total,
      shippingAddressId || null,
      customerNotes || null,
    ],
    connection
  );

  return getOrderById(id, connection);
};

export const insertOrderItems = async (connection, orderId, items) => {
  if (items.length === 0) return;

  const values = [];
  const placeholders = items.map(() => '(UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())').join(', ');

  for (const item of items) {
    values.push(
      orderId,
      item.variantId,
      item.quantity,
      item.priceAtPurchase,
      item.subtotal,
      item.productName,
      item.variantSku,
      item.variantAttributes
    );
  }

  await execute(
    `INSERT INTO order_items
        (id, orderId, variantId, quantity, priceAtPurchase, subtotal,
         productName, variantSku, variantAttributes, createdAt)
     VALUES ${placeholders}`,
    values,
    connection
  );
};

export const insertOrderStatusHistory = async (connection, data) => {
  const { orderId, fromStatus, toStatus, notes, changedById } = data;
  await execute(
    `INSERT INTO order_status_history
        (id, orderId, fromStatus, toStatus, notes, changedById, changedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, NOW())`,
    [orderId, fromStatus || null, toStatus, notes || null, changedById || null],
    connection
  );
};

export const insertPayment = async (connection, data) => {
  const {
    orderId,
    amount,
    method,
    status,
    transactionId,
    gatewayResponse,
    processedAt,
    failedAt,
    failureReason,
  } = data;

  await execute(
    `INSERT INTO payments
        (id, orderId, amount, currency, method, status, transactionId, gatewayResponse,
         createdAt, updatedAt, processedAt, failedAt, failureReason)
     VALUES (UUID(), ?, ?, 'USD', ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)`,
    [
      orderId,
      amount,
      method,
      status,
      transactionId || null,
      gatewayResponse || null,
      processedAt || null,
      failedAt || null,
      failureReason || null,
    ],
    connection
  );
};

export const insertRefund = async (connection, data) => {
  const { id, orderId, amount, reason, refundedBy, refundedAt } = data;
  const refundId = id || crypto.randomUUID();
  await execute(
    `INSERT INTO refunds
        (id, orderId, amount, reason, refundedBy, refundedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [refundId, orderId, amount, reason || null, refundedBy || null, refundedAt || null],
    connection
  );

  return { id: refundId };
};

export const updateOrder = async (connection, orderId, updates) => {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  values.push(orderId);

  await execute(
    `UPDATE orders SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values,
    connection
  );
};

export const getOrderById = async (orderId, connection = null) =>
  executeOne(
    `SELECT o.*,
            a.fullName AS shippingFullName,
            a.phone AS shippingPhone,
            a.addressLine1 AS shippingAddressLine1,
            a.addressLine2 AS shippingAddressLine2,
            a.city AS shippingCity,
            a.state AS shippingState,
            a.postalCode AS shippingPostalCode,
            a.country AS shippingCountry
       FROM orders o
       LEFT JOIN addresses a ON a.id = o.shippingAddressId
      WHERE o.id = ?`,
    [orderId],
    connection
  );

export const getOrderItems = async (orderId) =>
  execute(
    `SELECT oi.*, pv.sku, pv.attributes, pv.price AS currentPrice,
            p.id AS productId, p.name AS productName, p.status AS productStatus,
            pi.url AS primaryImageUrl
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variantId
       JOIN products p ON p.id = pv.productId
       LEFT JOIN product_images pi ON pi.productId = p.id AND pi.isPrimary = 1
      WHERE oi.orderId = ?`,
    [orderId]
  );

export const getOrderPayments = async (orderId) =>
  execute(
    `SELECT id, amount, currency, method, status, transactionId, gatewayResponse,
            createdAt, updatedAt, processedAt, failedAt, failureReason
       FROM payments
      WHERE orderId = ?
      ORDER BY createdAt DESC`,
    [orderId]
  );

export const getOrderStatusHistory = async (orderId) =>
  execute(
    `SELECT id, fromStatus, toStatus, notes, changedById, changedAt
       FROM order_status_history
      WHERE orderId = ?
      ORDER BY changedAt DESC`,
    [orderId]
  );

export const listOrdersByUser = async (userId, page, limit, status = null) => {
  const offset = (page - 1) * limit;
  const conditions = ['userId = ?'];
  const params = [userId];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  return execute(
    `SELECT * FROM orders
      WHERE ${conditions.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countOrdersByUser = async (userId, status = null) => {
  const conditions = ['userId = ?'];
  const params = [userId];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  return executeOne(
    `SELECT COUNT(*) AS total FROM orders WHERE ${conditions.join(' AND ')}`,
    params
  );
};
