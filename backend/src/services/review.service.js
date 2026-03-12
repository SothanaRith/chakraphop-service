// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRODUCT REVIEWS & RATINGS SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AppError } from '../utils/errors.js';
import { getProductById } from '../repositories/product.repository.js';
import {
  countProductReviews,
  countPendingReviews,
  countUserReviews,
  deleteReviewById,
  findReviewByProductUser,
  getOrderItemForReview,
  getReviewById,
  incrementReviewVote,
  insertReview,
  listPendingReviews,
  listProductReviews,
  listUserReviews,
  ratingBreakdown,
  updateProductRating,
  updateReviewById,
} from '../repositories/review.repository.js';

/**
 * Create product review
 */
async function createReview({ 
  productId, 
  userId, 
  orderId = null, 
  rating, 
  title = null, 
  comment = null 
}) {
  // Validate rating
  if (rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }
  
  // Check if product exists
  const product = await getProductById(productId);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  
  // Check if user already reviewed this product
  const existing = await findReviewByProductUser(productId, userId);
  
  if (existing) {
    throw new AppError('You have already reviewed this product', 409);
  }
  
  // If orderId provided, verify user purchased this product
  if (orderId) {
    const orderItem = await getOrderItemForReview(orderId, productId);
    
    if (!orderItem || orderItem.userId !== userId) {
      throw new AppError('You have not purchased this product', 403);
    }
    
    if (orderItem.status !== 'DELIVERED') {
      throw new AppError('You can only review products after delivery', 400);
    }
  }
  
  // Create review
  const review = await insertReview({
    productId,
    userId,
    orderId,
    rating,
    title,
    comment,
    status: 'PENDING'
  });
  
  // Update product average rating
  await updateProductRating(productId);
  
  return review;
}

/**
 * Get product reviews
 */
async function getProductReviews({ 
  productId, 
  status = 'APPROVED', 
  page = 1, 
  limit = 10,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const skip = (page - 1) * limit;
  
  const where = { productId };
  if (status) {
    where.status = status;
  }
  
  const [reviews, total, ratingStats] = await Promise.all([
    listProductReviews({ productId, status, sortBy, sortOrder, limit, offset: skip }),
    countProductReviews({ productId, status }),
    ratingBreakdown(productId)
  ]);
  
  // Format rating breakdown
  const breakdown = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  };
  
  ratingStats.forEach(item => {
    breakdown[item.rating] = item.count;
  });
  
  return {
    reviews,
    pagination: {
      page,
      limit,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    },
    ratingBreakdown: breakdown
  };
}

/**
 * Get user's reviews
 */
async function getUserReviews({ userId, page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;
  
  const [reviews, total] = await Promise.all([
    listUserReviews({ userId, limit, offset: skip }),
    countUserReviews(userId)
  ]);
  
  return {
    reviews,
    pagination: {
      page,
      limit,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  };
}

/**
 * Update review
 */
async function updateReview({ reviewId, userId, rating, title, comment }) {
  const review = await getReviewById(reviewId);
  
  if (!review) {
    throw new AppError('Review not found', 404);
  }
  
  if (review.userId !== userId) {
    throw new AppError('You can only edit your own reviews', 403);
  }
  
  const updated = await updateReviewById(reviewId, {
    ...(rating && { rating }),
    ...(title && { title }),
    ...(comment && { comment }),
    status: 'PENDING'
  });
  
  // Update product rating
  await updateProductRating(review.productId);
  
  return updated;
}

/**
 * Delete review
 */
async function deleteReview({ reviewId, userId }) {
  const review = await getReviewById(reviewId);
  
  if (!review) {
    throw new AppError('Review not found', 404);
  }
  
  if (review.userId !== userId) {
    throw new AppError('You can only delete your own reviews', 403);
  }
  
  await deleteReviewById(reviewId);
  
  // Update product rating
  await updateProductRating(review.productId);
  
  return { success: true };
}

/**
 * Moderate review (admin)
 */
async function moderateReview({ 
  reviewId, 
  status, 
  moderatedById, 
  moderationNotes = null 
}) {
  if (!['APPROVED', 'REJECTED', 'FLAGGED'].includes(status)) {
    throw new AppError('Invalid moderation status', 400);
  }
  
  const review = await updateReviewById(reviewId, {
    status,
    moderatedById,
    moderatedAt: new Date(),
    moderationNotes
  });
  
  // Update product rating if approved/rejected
  if (status === 'APPROVED' || status === 'REJECTED') {
    await updateProductRating(review.productId);
  }
  
  return review;
}

/**
 * Get pending reviews for moderation (admin)
 */
async function getPendingReviews({ page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  
  const [reviews, total] = await Promise.all([
    listPendingReviews({ limit, offset: skip }),
    countPendingReviews()
  ]);
  
  return {
    reviews,
    pagination: {
      page,
      limit,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  };
}

/**
 * Update product's average rating
 */
/**
 * Mark review as helpful/unhelpful
 */
async function voteReview({ reviewId, helpful }) {
  await incrementReviewVote(reviewId, helpful ? 'helpful' : 'unhelpful');
  
  return { success: true };
}

export {
  createReview,
  getProductReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  moderateReview,
  getPendingReviews,
  voteReview
};
