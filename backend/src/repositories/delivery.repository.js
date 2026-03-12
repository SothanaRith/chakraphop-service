// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELIVERY REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const getActiveDeliveryMethods = async () =>
  execute(
    `SELECT id, name, type, description, basePrice, estimatedDaysMin, estimatedDays,
            minOrderAmount, maxOrderWeight, isActive, displayOrder
       FROM delivery_methods
      WHERE isActive = 1
      ORDER BY displayOrder ASC`
  );

export const getDeliveryMethodById = async (deliveryMethodId) =>
  executeOne(
    `SELECT id, name, type, description, basePrice, estimatedDaysMin, estimatedDays,
            minOrderAmount, maxOrderWeight, isActive, displayOrder
       FROM delivery_methods
      WHERE id = ?`,
    [deliveryMethodId]
  );

export const getDeliveryMethodByName = async (name) =>
  executeOne(
    `SELECT id, name, type, description, basePrice, estimatedDaysMin, estimatedDays,
            minOrderAmount, maxOrderWeight, isActive, displayOrder
       FROM delivery_methods
      WHERE name = ?`,
    [name]
  );

export const getAvailabilityRule = async (deliveryMethodId, country, state, city) =>
  executeOne(
    `SELECT id, deliveryMethodId, country, state, city, isAvailable
       FROM delivery_availability_rules
      WHERE deliveryMethodId = ?
        AND country = ?
        AND state <=> ?
        AND city <=> ?
      LIMIT 1`,
    [deliveryMethodId, country, state, city]
  );

export const insertDeliveryTracking = async (connection, trackingId, orderId) => {
  await execute(
    `INSERT INTO order_delivery_tracking
        (id, orderId, currentStatus, lastStatusUpdate, createdAt, updatedAt)
     VALUES (?, ?, 'PENDING', NOW(), NOW(), NOW())`,
    [trackingId, orderId],
    connection
  );

  return executeOne(
    `SELECT * FROM order_delivery_tracking WHERE id = ?`,
    [trackingId],
    connection
  );
};

export const getDeliveryTrackingByOrderId = async (orderId) =>
  executeOne(
    `SELECT * FROM order_delivery_tracking WHERE orderId = ?`,
    [orderId]
  );

export const getDeliveryStatusHistory = async (orderId) =>
  execute(
    `SELECT id, fromStatus, toStatus, changedBy, reason, notes, changedAt
       FROM order_delivery_status_history
      WHERE orderId = ?
      ORDER BY changedAt ASC`,
    [orderId]
  );

export const updateDeliveryTracking = async (connection, trackingId, updates) => {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  values.push(trackingId);

  await execute(
    `UPDATE order_delivery_tracking SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values,
    connection
  );
};

export const updateOrderDeliveryStatus = async (connection, orderId, updates) => {
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

export const insertDeliveryStatusHistory = async (connection, data) => {
  const { orderId, trackingId, fromStatus, toStatus, changedBy, reason, notes } = data;
  await execute(
    `INSERT INTO order_delivery_status_history
        (id, orderId, trackingId, fromStatus, toStatus, changedBy, reason, notes, changedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      orderId,
      trackingId,
      fromStatus || null,
      toStatus,
      changedBy || null,
      reason || null,
      notes || null,
    ],
    connection
  );
};

export const listDeliveryMethods = async (filters = {}) => {
  const conditions = [];
  const params = [];

  if (filters.active !== null && filters.active !== undefined) {
    conditions.push('isActive = ?');
    params.push(filters.active ? 1 : 0);
  }
  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT id, name, type, description, basePrice, estimatedDaysMin, estimatedDays,
            minOrderAmount, maxOrderWeight, isActive, displayOrder
       FROM delivery_methods
       ${whereClause}
      ORDER BY displayOrder ASC`,
    params
  );
};

export const listAvailabilityRules = async (deliveryMethodId) =>
  execute(
    `SELECT id, deliveryMethodId, country, state, city, isAvailable
       FROM delivery_availability_rules
      WHERE deliveryMethodId = ?
      ORDER BY country ASC`,
    [deliveryMethodId]
  );

export const createDeliveryMethod = async (data) => {
  const {
    name,
    type,
    basePrice,
    estimatedDaysMin,
    estimatedDays,
    description,
    minOrderAmount,
  } = data;

  await execute(
    `INSERT INTO delivery_methods
        (id, name, type, description, basePrice, estimatedDaysMin, estimatedDays,
         minOrderAmount, isActive, displayOrder, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
    [name, type, description || null, basePrice, estimatedDaysMin, estimatedDays, minOrderAmount || 0]
  );

  return executeOne(
    `SELECT * FROM delivery_methods WHERE name = ?`,
    [name]
  );
};

export const updateDeliveryMethod = async (methodId, data) => {
  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return null;

  values.push(methodId);

  await execute(
    `UPDATE delivery_methods SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return getDeliveryMethodById(methodId);
};

export const upsertAvailabilityRule = async (deliveryMethodId, country, state, city, isAvailable) => {
  const existing = await getAvailabilityRule(deliveryMethodId, country, state, city);

  if (existing) {
    await execute(
      `UPDATE delivery_availability_rules
          SET isAvailable = ?
        WHERE id = ?`,
      [isAvailable ? 1 : 0, existing.id]
    );

    return getAvailabilityRule(deliveryMethodId, country, state, city);
  }

  await execute(
    `INSERT INTO delivery_availability_rules
        (id, deliveryMethodId, country, state, city, isAvailable, createdAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, NOW())`,
    [deliveryMethodId, country, state || null, city || null, isAvailable ? 1 : 0]
  );

  return getAvailabilityRule(deliveryMethodId, country, state, city);
};
