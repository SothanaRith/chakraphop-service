// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADDRESS REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const listAddressesByUserId = async (userId) =>
  execute(
    `SELECT id, userId, fullName, phone, addressLine1, addressLine2, city, state,
            postalCode, country, isDefault, createdAt, updatedAt
       FROM addresses
      WHERE userId = ?
      ORDER BY isDefault DESC, createdAt DESC`,
    [userId]
  );

export const getAddressById = async (userId, addressId) =>
  executeOne(
    `SELECT id, userId, fullName, phone, addressLine1, addressLine2, city, state,
            postalCode, country, isDefault, createdAt, updatedAt
       FROM addresses
      WHERE id = ? AND userId = ?`,
    [addressId, userId]
  );

export const clearDefaultAddresses = async (userId, excludeAddressId = null, connection = null) => {
  if (excludeAddressId) {
    return execute(
      `UPDATE addresses SET isDefault = 0 WHERE userId = ? AND id <> ?`,
      [userId, excludeAddressId],
      connection
    );
  }

  return execute(
    `UPDATE addresses SET isDefault = 0 WHERE userId = ?`,
    [userId],
    connection
  );
};

export const insertAddress = async (userId, data, connection = null) => {
  const {
    fullName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    isDefault,
  } = data;

  await execute(
    `INSERT INTO addresses
        (id, userId, fullName, phone, addressLine1, addressLine2, city, state,
         postalCode, country, isDefault, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      userId,
      fullName,
      phone,
      addressLine1,
      addressLine2 || null,
      city,
      state,
      postalCode,
      country || 'USA',
      isDefault ? 1 : 0,
    ],
    connection
  );

  return executeOne(
    `SELECT id, userId, fullName, phone, addressLine1, addressLine2, city, state,
            postalCode, country, isDefault, createdAt, updatedAt
       FROM addresses
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 1`,
    [userId],
    connection
  );
};

export const updateAddress = async (addressId, updates, connection = null) => {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return null;

  values.push(addressId);

  await execute(
    `UPDATE addresses SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values,
    connection
  );

  return executeOne(
    `SELECT id, userId, fullName, phone, addressLine1, addressLine2, city, state,
            postalCode, country, isDefault, createdAt, updatedAt
       FROM addresses
      WHERE id = ?`,
    [addressId],
    connection
  );
};

export const deleteAddress = async (addressId, connection = null) =>
  execute(
    `DELETE FROM addresses WHERE id = ?`,
    [addressId],
    connection
  );
