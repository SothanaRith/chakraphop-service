// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RECENTLY VIEWED REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const getProductById = async (productId) =>
  executeOne(
    `SELECT id, status FROM products WHERE id = ?`,
    [productId]
  );

export const incrementProductViewCount = async (productId) =>
  execute(
    `UPDATE products SET viewCount = viewCount + 1, updatedAt = NOW() WHERE id = ?`,
    [productId]
  );

export const upsertRecentlyViewed = async (userId, productId) =>
  execute(
    `INSERT INTO recently_viewed
        (id, userId, productId, viewedAt)
     VALUES (UUID(), ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       viewedAt = NOW()`,
    [userId, productId]
  );

export const listRecentlyViewedByUser = async (userId, limit) =>
  execute(
    `SELECT rv.id, rv.userId, rv.productId, rv.viewedAt,
            p.name AS productName, p.slug AS productSlug, p.status AS productStatus,
            b.name AS brandName,
            c.name AS categoryName, c.slug AS categorySlug,
            pi.url AS primaryImageUrl,
            pv.id AS variantId, pv.price, pv.compareAtPrice, pv.stockQuantity
       FROM recently_viewed rv
       JOIN products p ON p.id = rv.productId
       LEFT JOIN brands b ON b.id = p.brandId
       LEFT JOIN categories c ON c.id = p.categoryId
       LEFT JOIN product_images pi ON pi.productId = p.id AND pi.isPrimary = 1
       LEFT JOIN product_variants pv ON pv.productId = p.id AND pv.isDefault = 1
      WHERE rv.userId = ?
      ORDER BY rv.viewedAt DESC
      LIMIT ?`,
    [userId, limit]
  );

export const listRecentlyViewedIdsToDelete = async (userId, offset) =>
  execute(
    `SELECT id
       FROM recently_viewed
      WHERE userId = ?
      ORDER BY viewedAt DESC
      LIMIT 100 OFFSET ?`,
    [userId, offset]
  );

export const deleteRecentlyViewedByIds = async (ids) => {
  if (ids.length === 0) return;
  return execute(
    `DELETE FROM recently_viewed WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids
  );
};

export const clearRecentlyViewed = async (userId) =>
  execute(
    `DELETE FROM recently_viewed WHERE userId = ?`,
    [userId]
  );

export const listTrendingProductIds = async (cutoffDate, limit) =>
  execute(
    `SELECT productId, COUNT(*) AS views
       FROM recently_viewed
      WHERE viewedAt >= ?
      GROUP BY productId
      ORDER BY views DESC
      LIMIT ?`,
    [cutoffDate, limit]
  );

export const listProductsByIds = async (productIds) => {
  if (productIds.length === 0) return [];

  return execute(
    `SELECT p.id, p.name, p.slug, p.status,
            b.name AS brandName,
            c.name AS categoryName, c.slug AS categorySlug,
            pi.url AS primaryImageUrl,
            pv.id AS variantId, pv.price, pv.compareAtPrice, pv.stockQuantity
       FROM products p
       LEFT JOIN brands b ON b.id = p.brandId
       LEFT JOIN categories c ON c.id = p.categoryId
       LEFT JOIN product_images pi ON pi.productId = p.id AND pi.isPrimary = 1
       LEFT JOIN product_variants pv ON pv.productId = p.id AND pv.isDefault = 1
      WHERE p.id IN (${productIds.map(() => '?').join(', ')})`,
    productIds
  );
};
