// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVENTORY ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router } from 'express';
import inventoryController from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { body, query } from 'express-validator';

const router = Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION RULES (COMPREHENSIVE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const checkAvailabilityValidation = [
  query('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  query('variantId')
    .optional()
    .isUUID()
    .withMessage('Variant ID must be a valid UUID')
];

const addStockValidation = [
  body('variantId')
    .notEmpty()
    .withMessage('Variant ID is required')
    .isUUID()
    .withMessage('Variant ID must be a valid UUID'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
    .custom(val => val < 1000000)
    .withMessage('Quantity cannot exceed 999,999 units'),
  body('purchaseOrderId')
    .optional()
    .isUUID()
    .withMessage('Purchase Order ID must be a valid UUID'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const adjustStockValidation = [
  body('variantId')
    .notEmpty()
    .withMessage('Variant ID is required')
    .isUUID()
    .withMessage('Variant ID must be a valid UUID'),
  body('quantity')
    .isInt()
    .withMessage('Quantity must be an integer')
    .custom(val => Math.abs(val) < 1000000)
    .withMessage('Adjustment cannot exceed ±999,999 units'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason is required for stock adjustment')
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters')
];

const releaseStockValidation = [
  body('variantId')
    .notEmpty()
    .withMessage('Variant ID is required')
    .isUUID()
    .withMessage('Variant ID must be a valid UUID'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason is required for stock release')
    .isLength({ min: 5 })
    .withMessage('Reason must be at least 5 characters')
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/inventory/:variantId/availability
 * @desc    Check stock availability
 * @access  Public
 */
router.get(
  '/:variantId/availability',
  checkAvailabilityValidation,
  validate,
  inventoryController.checkAvailability
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVENTORY MANAGER / ADMIN ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/inventory/:variantId/movements
 * @desc    Get stock movement history
 * @access  Private (Inventory Manager, Admin)
 */
router.get(
  '/:variantId/movements',
  authenticate,
  authorize(['INVENTORY_MANAGER', 'ADMIN']),
  inventoryController.getStockMovements
);

/**
 * @route   POST /api/inventory/add-stock
 * @desc    Add stock (purchase order receive)
 * @access  Private (Inventory Manager, Admin)
 * @validation All parameters required and validated
 */
router.post(
  '/add-stock',
  authenticate,
  authorize(['INVENTORY_MANAGER', 'ADMIN']),
  addStockValidation,
  validate,
  inventoryController.addStock
);

/**
 * @route   POST /api/inventory/adjust-stock
 * @desc    Adjust stock manually (increase or decrease)
 * @access  Private (Inventory Manager, Admin)
 * @validation Quantity can be positive or negative; reason required
 */
router.post(
  '/adjust-stock',
  authenticate,
  authorize(['INVENTORY_MANAGER', 'ADMIN']),
  adjustStockValidation,
  validate,
  inventoryController.adjustStock
);

/**
 * @route   POST /api/inventory/release-stock
 * @desc    Release reserved stock (refund/cancellation)
 * @access  Private (Admin only - sensitive operation)
 * @validation All parameters required and validated
 */
router.post(
  '/release-stock',
  authenticate,
  authorize(['ADMIN']),
  releaseStockValidation,
  validate,
  inventoryController.releaseStock
);

/**
 * @route   GET /api/inventory/low-stock
 * @desc    Get low stock report
 * @access  Private (Inventory Manager, Admin)
 */
router.get(
  '/low-stock',
  authenticate,
  authorize(['INVENTORY_MANAGER', 'ADMIN']),
  inventoryController.getLowStockReport
);

/**
 * @route   GET /api/inventory/summary
 * @desc    Get inventory summary
 * @access  Private (Inventory Manager, Admin)
 */
router.get(
  '/summary',
  authenticate,
  authorize(['INVENTORY_MANAGER', 'ADMIN']),
  inventoryController.getInventorySummary
);

export default router;
