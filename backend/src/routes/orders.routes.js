// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORDERS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router } from 'express';
import ordersController from '../controllers/orders.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { body } from 'express-validator';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION RULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const createOrderValidation = [
  body('shippingAddressId')
    .notEmpty()
    .withMessage('Shipping address is required'),
  body('billingAddressId')
    .optional(),
  body('notes')
    .optional()
    .trim()
];

const paymentSuccessValidation = [
  body('paymentMethod')
    .isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH_ON_DELIVERY'])
    .withMessage('Valid payment method is required'),
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Valid amount is required')
];

const paymentFailureValidation = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Failure reason is required'),
  body('transactionId')
    .optional()
];

const cancelOrderValidation = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Cancellation reason is required')
];

const updateStatusValidation = [
  body('status')
    .isIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
    .withMessage('Valid status is required')
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOMER ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/orders
 * @desc    Get user's orders
 * @access  Private
 */
router.get('/', ordersController.getUserOrders);

/**
 * @route   POST /api/orders
 * @desc    Create order from cart
 * @access  Private
 */
router.post('/', createOrderValidation, validate, ordersController.createOrder);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get('/:id', ordersController.getOrderById);

/**
 * @route   POST /api/orders/:id/confirm
 * @desc    Confirm order (reserve stock)
 * @access  Private
 */
router.post('/:id/confirm', ordersController.confirmOrder);

/**
 * @route   POST /api/orders/:id/payment-success
 * @desc    Process successful payment
 * @access  Private
 */
router.post(
  '/:id/payment-success',
  paymentSuccessValidation,
  validate,
  ordersController.processPaymentSuccess
);

/**
 * @route   POST /api/orders/:id/payment-failure
 * @desc    Process payment failure
 * @access  Private
 */
router.post(
  '/:id/payment-failure',
  paymentFailureValidation,
  validate,
  ordersController.processPaymentFailure
);

/**
 * @route   POST /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private
 */
router.post(
  '/:id/cancel',
  cancelOrderValidation,
  validate,
  ordersController.cancelOrder
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Update order status
 * @access  Private (Admin, Sales Agent)
 */
router.patch(
  '/:id/status',
  authorize(['ADMIN', 'SALES_AGENT']),
  updateStatusValidation,
  validate,
  ordersController.updateOrderStatus
);

export default router;
