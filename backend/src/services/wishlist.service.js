// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WISHLIST SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AppError } from '../utils/errors.js';
import {
  deleteWishlistItem,
  deleteWishlistItemsByUser,
  findWishlistItem,
  listWishlistItemsByUser,
  upsertWishlistItem,
} from '../repositories/wishlist.repository.js';
import { getProductById, getProductWithVariants } from '../repositories/product.repository.js';
import {
  getCartItemByUserVariant,
  updateCartItemQuantity,
  upsertCartItem,
} from '../repositories/cart.repository.js';

/**
 * Get user's wishlist
 */
async function getUserWishlist(userId) {
  return listWishlistItemsByUser(userId);
}

/**
 * Add product to wishlist
 */
async function addToWishlist({ userId, productId, notes = null, priority = 0 }) {
  // Check if product exists
  const product = await getProductById(productId);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return upsertWishlistItem({ userId, productId, notes, priority });
}

/**
 * Remove from wishlist
 */
async function removeFromWishlist({ userId, productId }) {
  await deleteWishlistItem(userId, productId);
  
  return { success: true };
}

/**
 * Clear entire wishlist
 */
async function clearWishlist(userId) {
  await deleteWishlistItemsByUser(userId);
  
  return { success: true };
}

/**
 * Move wishlist item to cart
 */
async function moveToCart({ userId, productId }) {
  const wishlistItem = await findWishlistItem(userId, productId);
  
  if (!wishlistItem) {
    throw new AppError('Item not found in wishlist', 404);
  }

  const product = await getProductWithVariants(productId);
  const defaultVariant = product?.variants?.find((variant) => variant.isDefault) || product?.variants?.[0];
  
  if (!defaultVariant) {
    throw new AppError('Product has no available variants', 400);
  }
  
  // Check stock
  if (defaultVariant.stockQuantity <= 0) {
    throw new AppError('Product is out of stock', 400);
  }
  
  // Add to cart
  const existingCartItem = await getCartItemByUserVariant(userId, defaultVariant.id);
  const nextQuantity = existingCartItem ? existingCartItem.quantity + 1 : 1;

  if (existingCartItem) {
    await updateCartItemQuantity(userId, defaultVariant.id, nextQuantity, defaultVariant.price);
  } else {
    await upsertCartItem(userId, defaultVariant.id, nextQuantity, defaultVariant.price);
  }
  
  // Remove from wishlist
  await deleteWishlistItem(userId, productId);
  
  return { success: true, message: 'Item moved to cart' };
}

/**
 * Check if product is in wishlist
 */
async function isInWishlist({ userId, productId }) {
  const item = await findWishlistItem(userId, productId);
  
  return { inWishlist: !!item };
}

export {
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  moveToCart,
  isInWishlist
};
