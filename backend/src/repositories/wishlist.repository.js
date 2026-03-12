// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WISHLIST REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const listWishlistItemsByUser = async (userId) =>
  execute(
    `SELECT wi.id, wi.userId, wi.productId, wi.notes, wi.priority, wi.createdAt,
            p.name AS productName, p.slug AS productSlug, p.status AS productStatus,
            b.name AS brandName,
            c.name AS categoryName, c.slug AS categorySlug,
            pi.url AS primaryImageUrl,
            pv.id AS variantId, pv.price, pv.compareAtPrice, pv.stockQuantity
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.productId
       LEFT JOIN brands b ON b.id = p.brandId
       LEFT JOIN categories c ON c.id = p.categoryId
       LEFT JOIN product_images pi ON pi.productId = p.id AND pi.isPrimary = 1
       LEFT JOIN product_variants pv ON pv.productId = p.id AND pv.isDefault = 1
      WHERE wi.userId = ?
      ORDER BY wi.priority DESC, wi.createdAt DESC`,
    [userId]
  );

export const findWishlistItem = async (userId, productId) =>
  executeOne(
    `SELECT id, userId, productId, notes, priority
       FROM wishlist_items
      WHERE userId = ? AND productId = ?`,
    [userId, productId]
  );

export const upsertWishlistItem = async (data) => {
  const { userId, productId, notes, priority } = data;
  await execute(
    `INSERT INTO wishlist_items
        (id, userId, productId, notes, priority, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       notes = VALUES(notes),
       priority = VALUES(priority),
       updatedAt = NOW()`,
    [userId, productId, notes || null, priority || 0]
  );

  return findWishlistItem(userId, productId);
};

export const deleteWishlistItem = async (userId, productId) =>
  execute(
    `DELETE FROM wishlist_items WHERE userId = ? AND productId = ?`,
    [userId, productId]
  );

export const deleteWishlistItemsByUser = async (userId) =>
  execute(
    `DELETE FROM wishlist_items WHERE userId = ?`,
    [userId]
  );
