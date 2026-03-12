// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USERS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { body } from 'express-validator';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION RULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const addAddressValidation = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required'),
  body('addressLine1')
    .trim()
    .notEmpty()
    .withMessage('Address line 1 is required'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State/Province is required'),
  body('postalCode')
    .trim()
    .notEmpty()
    .withMessage('Postal code is required'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('phoneNumber')
    .trim()
    .notEmpty()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Valid phone number is required')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain uppercase, lowercase, and number')
];

const updateRoleValidation = [
  body('role')
    .isIn(['CUSTOMER', 'STUDENT', 'INSTRUCTOR', 'SALES_AGENT', 'INVENTORY_MANAGER', 'ADMIN', 'SUPER_ADMIN'])
    .withMessage('Valid role is required')
];

const toggleStatusValidation = [
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOMER ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PATCH /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.patch('/profile', userController.updateProfile);

/**
 * @route   POST /api/users/change-password
 * @desc    Change password
 * @access  Private
 */
router.post(
  '/change-password',
  changePasswordValidation,
  validate,
  userController.changePassword
);

/**
 * @route   POST /api/users/addresses
 * @desc    Add address
 * @access  Private
 */
router.post('/addresses', addAddressValidation, validate, userController.addAddress);

/**
 * @route   PATCH /api/users/addresses/:id
 * @desc    Update address
 * @access  Private
 */
router.patch('/addresses/:id', userController.updateAddress);

/**
 * @route   DELETE /api/users/addresses/:id
 * @desc    Delete address
 * @access  Private
 */
router.delete('/addresses/:id', userController.deleteAddress);

/**
 * @route   GET /api/users/orders
 * @desc    Get user orders
 * @access  Private
 */
router.get('/orders', userController.getOrders);

/**
 * @route   GET /api/users/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get('/orders/:id', userController.getOrderById);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin)
 */
router.get('/', authorize(['ADMIN']), userController.getAllUsers);

/**
 * @route   PATCH /api/users/:id/role
 * @desc    Update user role
 * @access  Private (Admin)
 */
router.patch(
  '/:id/role',
  authorize(['ADMIN']),
  updateRoleValidation,
  validate,
  userController.updateUserRole
);

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Toggle user status (activate/deactivate)
 * @access  Private (Admin)
 */
router.patch(
  '/:id/status',
  authorize(['ADMIN']),
  toggleStatusValidation,
  validate,
  userController.toggleUserStatus
);

export default router;
