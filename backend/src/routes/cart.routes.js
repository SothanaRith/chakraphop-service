// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CART ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router } from 'express';
import cartController from '../controllers/cart.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { body } from 'express-validator';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION RULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const addItemValidation = [
  body('variantId')
    .notEmpty()
    .withMessage('Variant ID is required'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
];

const updateQuantityValidation = [
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/cart
 * @desc    Get user's cart
 * @access  Private
 */
router.get('/', cartController.getCart);

/**
 * @route   POST /api/cart/items
 * @desc    Add item to cart
 * @access  Private
 */
router.post('/items', addItemValidation, validate, cartController.addItem);

/**
 * @route   PATCH /api/cart/items/:variantId
 * @desc    Update cart item quantity
 * @access  Private
 */
router.patch(
  '/items/:variantId',
  updateQuantityValidation,
  validate,
  cartController.updateItemQuantity
);

/**
 * @route   DELETE /api/cart/items/:variantId
 * @desc    Remove item from cart
 * @access  Private
 */
router.delete('/items/:variantId', cartController.removeItem);

/**
 * @route   DELETE /api/cart
 * @desc    Clear entire cart
 * @access  Private
 */
router.delete('/', cartController.clearCart);

/**
 * @route   POST /api/cart/validate
 * @desc    Validate cart before checkout
 * @access  Private
 */
router.post('/validate', cartController.validateCart);

/**
 * @route   POST /api/cart/sync
 * @desc    Sync cart prices with current prices
 * @access  Private
 */
router.post('/sync', cartController.syncCartPrices);

export default router;
