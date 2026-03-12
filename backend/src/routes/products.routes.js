// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRODUCTS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router } from 'express';
import productsController from '../controllers/products.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { body, query } from 'express-validator';

const router = Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION RULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const createProductValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required'),
  body('slug')
    .trim()
    .notEmpty()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Valid slug is required (lowercase, hyphens only)'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('categoryId')
    .notEmpty()
    .withMessage('Category is required'),
  body('basePrice')
    .isFloat({ min: 0 })
    .withMessage('Valid base price is required'),
  body('variants')
    .isArray({ min: 1 })
    .withMessage('At least one variant is required')
];

const searchValidation = [
  query('q')
    .trim()
    .notEmpty()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters')
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/products/search
 * @desc    Search products
 * @access  Public
 */
router.get('/search', searchValidation, validate, productsController.searchProducts);

/**
 * @route   GET /api/products/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get('/categories', productsController.getCategories);

/**
 * @route   GET /api/products/brands
 * @desc    Get all brands
 * @access  Public
 */
router.get('/brands', productsController.getBrands);

/**
 * @route   GET /api/products/:slug
 * @desc    Get product by slug
 * @access  Public
 */
router.get('/:slug', productsController.getProductBySlug);

/**
 * @route   GET /api/products
 * @desc    Get all products with filters
 * @access  Public
 */
router.get('/', productsController.getProducts);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   POST /api/products
 * @desc    Create product
 * @access  Private (Admin, Inventory Manager)
 */
router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'INVENTORY_MANAGER']),
  createProductValidation,
  validate,
  productsController.createProduct
);

/**
 * @route   PATCH /api/products/:id
 * @desc    Update product
 * @access  Private (Admin, Inventory Manager)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'INVENTORY_MANAGER']),
  productsController.updateProduct
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  productsController.deleteProduct
);

export default router;
