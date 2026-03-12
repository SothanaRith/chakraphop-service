// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RECENTLY VIEWED PRODUCTS SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  clearRecentlyViewed as clearRecentlyViewedRepo,
  deleteRecentlyViewedByIds,
  getProductById,
  incrementProductViewCount,
  listProductsByIds,
  listRecentlyViewedByUser,
  listRecentlyViewedIdsToDelete,
  listTrendingProductIds,
  upsertRecentlyViewed,
} from '../repositories/recently-viewed.repository.js';

const MAX_RECENTLY_VIEWED = 20; // Keep last 20 viewed products

/**
 * Track product view
 */
async function trackProductView({ userId, productId }) {
  // Check if product exists
  const product = await getProductById(productId);
  
  if (!product) {
    return;
  }
  
  // Increment product view count
  await incrementProductViewCount(productId);
  
  // Update user's recently viewed (upsert)
  await upsertRecentlyViewed(userId, productId);
  
  // Clean up old views (keep only last N products)
  const userViews = await listRecentlyViewedIdsToDelete(userId, MAX_RECENTLY_VIEWED);
  
  if (userViews.length > 0) {
    await deleteRecentlyViewedByIds(userViews.map((view) => view.id));
  }
}

/**
 * Get user's recently viewed products
 */
async function getRecentlyViewed({ userId, limit = 10 }) {
  return listRecentlyViewedByUser(userId, limit);
}

/**
 * Clear recently viewed history
 */
async function clearRecentlyViewed(userId) {
  await clearRecentlyViewedRepo(userId);
  
  return { success: true };
}

/**
 * Get trending products (most viewed in last N days)
 */
async function getTrendingProducts({ days = 7, limit = 10 }) {
  // Get products with most views in the period
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const viewCounts = await listTrendingProductIds(cutoffDate, limit);
  
  const productIds = viewCounts.map(vc => vc.productId);
  const products = await listProductsByIds(productIds);
  
  const productMap = new Map(products.map(p => [p.id, p]));
  return productIds
    .map(id => productMap.get(id))
    .filter(p => p);
}

export {
  trackProductView,
  getRecentlyViewed,
  clearRecentlyViewed,
  getTrendingProducts
};
