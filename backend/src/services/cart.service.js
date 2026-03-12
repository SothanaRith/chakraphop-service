// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CART SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { withTransactionRetry } from '../db/index.js';
import {
  deleteCartItem,
  deleteCartItemsByUser,
  getCartItemByUserVariant,
  getCartItemsByUserId,
  updateCartItemPrices,
  updateCartItemQuantity,
  upsertCartItem,
} from '../repositories/cart.repository.js';
import { getProductVariantById } from '../repositories/product.repository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../config/logger.js';
import ProductVariant from '../models/product-variant.model.js';

class CartService {
  /**
   * Get user's cart with all items
   */
  async getCart(userId) {
    const items = await getCartItemsByUserId(userId);

    if (!items || items.length === 0) {
      return { items: [], subtotal: 0, itemCount: 0 };
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + (Number(item.priceSnapshot) * item.quantity);
    }, 0);

    return {
      items,
      subtotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  /**
   * Add item to cart
   */
  async addItem(userId, variantId, quantity = 1) {
    // Validate variant and stock
    const variant = await getProductVariantById(variantId);

    if (!variant) {
      throw new NotFoundError('Product variant not found');
    }

    const variantModel = ProductVariant.fromData(variant);
    variantModel.assertCanSell(quantity);

    const existingItem = await getCartItemByUserVariant(userId, variantId);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;

      // Check stock for new quantity
      if (variant.stockQuantity < newQuantity) {
        throw new ValidationError(`Cannot add ${quantity} more. Only ${variant.stockQuantity - existingItem.quantity} additional items available`);
      }

      // Update existing item
      await updateCartItemQuantity(userId, variantId, newQuantity, variant.price);

      logger.info('Cart item updated', { userId, variantId, quantity: newQuantity });
    } else {
      // Add new item
      await upsertCartItem(userId, variantId, quantity, variant.price);

      logger.info('Item added to cart', { userId, variantId, quantity });
    }

    // Return updated cart
    return await this.getCart(userId);
  }

  /**
   * Update cart item quantity
   */
  async updateItemQuantity(userId, variantId, quantity) {
    if (quantity < 1) {
      throw new ValidationError('Quantity must be at least 1');
    }

    // Get cart
    const existingItem = await getCartItemByUserVariant(userId, variantId);

    if (!existingItem) {
      throw new NotFoundError('Cart item not found');
    }

    // Check stock availability
    const variant = await getProductVariantById(variantId);

    if (!variant) {
      throw new NotFoundError('Product variant not found');
    }

    const variantModel = ProductVariant.fromData(variant);
    variantModel.assertCanSell(quantity);

    // Update quantity
    await updateCartItemQuantity(userId, variantId, quantity, variant.price);

    logger.info('Cart item quantity updated', { userId, variantId, quantity });

    return await this.getCart(userId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId, variantId) {
    const existingItem = await getCartItemByUserVariant(userId, variantId);

    if (!existingItem) {
      throw new NotFoundError('Cart item not found');
    }

    await deleteCartItem(userId, variantId);

    logger.info('Item removed from cart', { userId, variantId });

    return await this.getCart(userId);
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId) {
    await deleteCartItemsByUser(userId);

    logger.info('Cart cleared', { userId });

    return await this.getCart(userId);
  }

  /**
   * Validate cart before checkout (stock check)
   */
  async validateCart(userId) {
    const items = await getCartItemsByUserId(userId);

    if (!items || items.length === 0) {
      throw new ValidationError('Cart is empty');
    }

    const errors = [];

    for (const item of items) {
      // Check product status
      const variantModel = ProductVariant.fromData(item);
      if (item.productStatus !== 'ACTIVE') {
        errors.push({
          variantId: item.variantId,
          message: `${item.productName} is no longer available`
        });
        continue;
      }

      // Check variant status
      if (!variantModel.isActive) {
        errors.push({
          variantId: item.variantId,
          message: `${item.productName} variant is no longer available`
        });
        continue;
      }

      // Check stock
      if (!variantModel.canSell(item.quantity)) {
        errors.push({
          variantId: item.variantId,
          message: `Only ${item.stockQuantity} items available for ${item.productName}`
        });
      }

      // Check price changes
      if (Number(item.priceSnapshot) !== Number(item.currentPrice)) {
        errors.push({
          variantId: item.variantId,
          message: `Price updated for ${item.productName}`,
          oldPrice: item.priceSnapshot,
          newPrice: item.currentPrice
        });
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors
      };
    }

    return {
      valid: true,
      cart: { items }
    };
  }

  /**
   * Sync cart prices (update to current prices)
   */
  async syncCartPrices(userId) {
    const items = await getCartItemsByUserId(userId);

    if (!items || items.length === 0) {
      return null;
    }

    const updates = items
      .filter(item => Number(item.priceSnapshot) !== Number(item.currentPrice))
      .map(item => ({
        variantId: item.variantId,
        priceSnapshot: item.currentPrice,
      }));

    if (updates.length > 0) {
      await withTransactionRetry(async (connection) => {
        await updateCartItemPrices(userId, updates, connection);
      }, { isolationLevel: 'READ COMMITTED' });
      logger.info('Cart prices synced', { userId, updatedItems: updates.length });
    }

    return await this.getCart(userId);
  }
}

export default new CartService();
