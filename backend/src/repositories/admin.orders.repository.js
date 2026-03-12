// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ORDERS REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const listOrders = async ({ status, userId, dateFrom, dateTo, search, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (userId) {
    conditions.push('o.userId = ?');
    params.push(userId);
  }
  if (dateFrom) {
    conditions.push('o.createdAt >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('o.createdAt <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push('(o.orderNumber LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT o.*, u.firstName, u.lastName, u.email
       FROM orders o
       JOIN users u ON u.id = o.userId
      ${whereClause}
      ORDER BY o.createdAt DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countOrders = async ({ status, userId, dateFrom, dateTo, search }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (userId) {
    conditions.push('o.userId = ?');
    params.push(userId);
  }
  if (dateFrom) {
    conditions.push('o.createdAt >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('o.createdAt <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push('(o.orderNumber LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executeOne(
    `SELECT COUNT(*) AS total
       FROM orders o
       JOIN users u ON u.id = o.userId
      ${whereClause}`,
    params
  );
};

export const getOrderById = async (orderId) =>
  executeOne(
    `SELECT o.*, u.firstName, u.lastName, u.email, u.phone
       FROM orders o
       JOIN users u ON u.id = o.userId
      WHERE o.id = ?`,
    [orderId]
  );

export const getOrderByNumber = async (orderNumber) =>
  executeOne(
    `SELECT o.*, u.firstName, u.lastName, u.email
       FROM orders o
       JOIN users u ON u.id = o.userId
      WHERE o.orderNumber = ?`,
    [orderNumber]
  );

export const listOrderItems = async (orderId) =>
  execute(
    `SELECT oi.*, pv.sku, p.name AS productName
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variantId
       JOIN products p ON p.id = pv.productId
      WHERE oi.orderId = ?`,
    [orderId]
  );

export const listOrderPayments = async (orderId) =>
  execute(
    `SELECT * FROM payments WHERE orderId = ? ORDER BY createdAt DESC`,
    [orderId]
  );

export const listOrderStatusHistory = async (orderId) =>
  execute(
    `SELECT * FROM order_status_history WHERE orderId = ? ORDER BY changedAt DESC`,
    [orderId]
  );

export const listOrderNotes = async (orderId) =>
  execute(
    `SELECT * FROM order_notes WHERE orderId = ? ORDER BY createdAt DESC`,
    [orderId]
  );

export const insertOrderNote = async (data) => {
  const { orderId, note, isInternal, createdBy } = data;
  await execute(
    `INSERT INTO order_notes
        (id, orderId, note, isInternal, createdBy, createdAt)
     VALUES (UUID(), ?, ?, ?, ?, NOW())`,
    [orderId, note, isInternal ? 1 : 0, createdBy]
  );

  return executeOne(
    `SELECT * FROM order_notes WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1`,
    [orderId]
  );
};

export const listOrdersByStatusSince = async (status, cutoffDate) =>
  execute(
    `SELECT * FROM orders WHERE status = ? AND createdAt <= ?`,
    [status, cutoffDate]
  );

export const listOrdersForExport = async ({ status, dateFrom, dateTo }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('o.createdAt >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('o.createdAt <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT o.*, u.firstName, u.lastName, u.email,
            COUNT(oi.id) AS itemCount
       FROM orders o
       JOIN users u ON u.id = o.userId
       LEFT JOIN order_items oi ON oi.orderId = o.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.createdAt DESC`,
    params
  );
};

export const listOrdersByDateRangeAndStatuses = async (startDate, statuses) => {
  if (!statuses || statuses.length === 0) return [];

  return execute(
    `SELECT total, status
       FROM orders
      WHERE createdAt >= ? AND status IN (${statuses.map(() => '?').join(', ')})`,
    [startDate, ...statuses]
  );
};
