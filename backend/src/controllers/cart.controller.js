// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CART CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import cartService from '../services/cart.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class CartController {
  /**
   * Get cart
   * GET /api/cart
   */
  getCart = asyncHandler(async (req, res) => {
    const cart = await cartService.getCart(req.user.id);
    res.json(success(cart));
  });

  /**
   * Add item to cart
   * POST /api/cart/items
   */
  addItem = asyncHandler(async (req, res) => {
    const { variantId, quantity } = req.body;
    const cart = await cartService.addItem(req.user.id, variantId, quantity);
    res.status(201).json(success(cart, 'Item added to cart'));
  });

  /**
   * Update cart item quantity
   * PATCH /api/cart/items/:variantId
   */
  updateItemQuantity = asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const { quantity } = req.body;
    const cart = await cartService.updateItemQuantity(req.user.id, variantId, quantity);
    res.json(success(cart, 'Cart updated'));
  });

  /**
   * Remove item from cart
   * DELETE /api/cart/items/:variantId
   */
  removeItem = asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const cart = await cartService.removeItem(req.user.id, variantId);
    res.json(success(cart, 'Item removed from cart'));
  });

  /**
   * Clear cart
   * DELETE /api/cart
   */
  clearCart = asyncHandler(async (req, res) => {
    await cartService.clearCart(req.user.id);
    res.json(success(null, 'Cart cleared'));
  });

  /**
   * Validate cart before checkout
   * POST /api/cart/validate
   */
  validateCart = asyncHandler(async (req, res) => {
    const validation = await cartService.validateCart(req.user.id);
    res.json(success(validation));
  });

  /**
   * Sync cart prices
   * POST /api/cart/sync
   */
  syncCartPrices = asyncHandler(async (req, res) => {
    const cart = await cartService.syncCartPrices(req.user.id);
    res.json(success(cart, 'Cart prices synchronized'));
  });
}

export default new CartController();
