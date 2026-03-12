// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REVIEW REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const findReviewByProductUser = async (productId, userId) =>
  executeOne(
    `SELECT id, productId, userId, rating, title, comment, status
       FROM product_reviews
      WHERE productId = ? AND userId = ?`,
    [productId, userId]
  );

export const insertReview = async (data) => {
  const { productId, userId, orderId, rating, title, comment, status } = data;
  await execute(
    `INSERT INTO product_reviews
        (id, productId, userId, orderId, rating, title, comment, status, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [productId, userId, orderId || null, rating, title || null, comment || null, status]
  );

  return executeOne(
    `SELECT * FROM product_reviews WHERE productId = ? AND userId = ?`,
    [productId, userId]
  );
};

export const updateReviewById = async (reviewId, updates) => {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return null;

  values.push(reviewId);

  await execute(
    `UPDATE product_reviews SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return executeOne(
    `SELECT * FROM product_reviews WHERE id = ?`,
    [reviewId]
  );
};

export const deleteReviewById = async (reviewId) =>
  execute(
    `DELETE FROM product_reviews WHERE id = ?`,
    [reviewId]
  );

export const listProductReviews = async ({ productId, status, sortBy, sortOrder, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (productId) {
    conditions.push('productId = ?');
    params.push(productId);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const orderClause = sortBy ? `ORDER BY ${sortBy} ${sortOrder}` : 'ORDER BY createdAt DESC';

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT pr.*, u.firstName, u.lastName
       FROM product_reviews pr
       JOIN users u ON u.id = pr.userId
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countProductReviews = async ({ productId, status }) => {
  const conditions = [];
  const params = [];

  if (productId) {
    conditions.push('productId = ?');
    params.push(productId);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executeOne(
    `SELECT COUNT(*) AS total FROM product_reviews ${whereClause}`,
    params
  );
};

export const ratingBreakdown = async (productId) =>
  execute(
    `SELECT rating, COUNT(*) AS count
       FROM product_reviews
      WHERE productId = ? AND status = 'APPROVED'
      GROUP BY rating`,
    [productId]
  );

export const listUserReviews = async ({ userId, limit, offset }) =>
  execute(
    `SELECT pr.*, p.name AS productName, p.slug AS productSlug, pi.url AS primaryImageUrl
       FROM product_reviews pr
       JOIN products p ON p.id = pr.productId
       LEFT JOIN product_images pi ON pi.productId = p.id AND pi.isPrimary = 1
      WHERE pr.userId = ?
      ORDER BY pr.createdAt DESC
      LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

export const countUserReviews = async (userId) =>
  executeOne(
    `SELECT COUNT(*) AS total FROM product_reviews WHERE userId = ?`,
    [userId]
  );

export const listPendingReviews = async ({ limit, offset }) =>
  execute(
    `SELECT pr.*, u.firstName, u.lastName, u.email,
            p.id AS productId, p.name AS productName, p.slug AS productSlug
       FROM product_reviews pr
       JOIN users u ON u.id = pr.userId
       JOIN products p ON p.id = pr.productId
      WHERE pr.status = 'PENDING'
      ORDER BY pr.createdAt ASC
      LIMIT ? OFFSET ?`,
    [limit, offset]
  );

export const countPendingReviews = async () =>
  executeOne(
    `SELECT COUNT(*) AS total FROM product_reviews WHERE status = 'PENDING'`
  );

export const getReviewById = async (reviewId) =>
  executeOne(
    `SELECT * FROM product_reviews WHERE id = ?`,
    [reviewId]
  );

export const getOrderItemForReview = async (orderId, productId) =>
  executeOne(
    `SELECT oi.id, o.userId, o.status
       FROM order_items oi
       JOIN orders o ON o.id = oi.orderId
       JOIN product_variants pv ON pv.id = oi.variantId
      WHERE oi.orderId = ? AND pv.productId = ?
      LIMIT 1`,
    [orderId, productId]
  );

export const updateProductRating = async (productId) => {
  const stats = await executeOne(
    `SELECT AVG(rating) AS avgRating, COUNT(*) AS reviewCount
       FROM product_reviews
      WHERE productId = ? AND status = 'APPROVED'`,
    [productId]
  );

  const avgRating = stats?.avgRating ? Number(stats.avgRating) : null;
  const reviewCount = stats?.reviewCount ? Number(stats.reviewCount) : 0;

  await execute(
    `UPDATE products
        SET averageRating = ?, reviewCount = ?, updatedAt = NOW()
      WHERE id = ?`,
    [avgRating, reviewCount, productId]
  );
};

export const incrementReviewVote = async (reviewId, field) => {
  const column = field === 'helpful' ? 'helpfulCount' : 'unhelpfulCount';
  return execute(
    `UPDATE product_reviews
        SET ${column} = ${column} + 1,
            updatedAt = NOW()
      WHERE id = ?`,
    [reviewId]
  );
};
