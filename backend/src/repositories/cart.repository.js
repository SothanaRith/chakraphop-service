// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CART REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const getCartItemsByUserId = async (userId) =>
  execute(
    `SELECT ci.userId, ci.variantId, ci.quantity, ci.priceSnapshot, ci.createdAt, ci.updatedAt,
            pv.price AS currentPrice, pv.stockQuantity, pv.isActive, pv.sku, pv.attributes,
            p.id AS productId, p.name AS productName, p.status AS productStatus,
            pi.url AS primaryImageUrl
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variantId
       JOIN products p ON p.id = pv.productId
       LEFT JOIN product_images pi ON pi.productId = p.id AND pi.isPrimary = 1
      WHERE ci.userId = ?`,
    [userId]
  );

export const getCartItemByUserVariant = async (userId, variantId) =>
  executeOne(
    `SELECT userId, variantId, quantity, priceSnapshot
       FROM cart_items
      WHERE userId = ? AND variantId = ?`,
    [userId, variantId]
  );

export const upsertCartItem = async (userId, variantId, quantity, priceSnapshot) =>
  execute(
    `INSERT INTO cart_items (id, userId, variantId, quantity, priceSnapshot, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       quantity = VALUES(quantity),
       priceSnapshot = VALUES(priceSnapshot),
       updatedAt = NOW()`,
    [userId, variantId, quantity, priceSnapshot]
  );

export const updateCartItemQuantity = async (userId, variantId, quantity, priceSnapshot) =>
  execute(
    `UPDATE cart_items
        SET quantity = ?,
            priceSnapshot = ?,
            updatedAt = NOW()
      WHERE userId = ? AND variantId = ?`,
    [quantity, priceSnapshot, userId, variantId]
  );

export const deleteCartItem = async (userId, variantId) =>
  execute(
    `DELETE FROM cart_items WHERE userId = ? AND variantId = ?`,
    [userId, variantId]
  );

export const deleteCartItemsByUser = async (userId) =>
  execute(
    `DELETE FROM cart_items WHERE userId = ?`,
    [userId]
  );

export const updateCartItemPrices = async (userId, updates, connection = null) => {
  for (const update of updates) {
    await execute(
      `UPDATE cart_items
          SET priceSnapshot = ?,
              updatedAt = NOW()
        WHERE userId = ? AND variantId = ?`,
      [update.priceSnapshot, userId, update.variantId],
      connection
    );
  }
};
