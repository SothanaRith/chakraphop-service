// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router } from 'express';
import ordersController from '../controllers/orders.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORDERS MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders (read-only view)
 * @access  Private (Admin, Sales Agent)
 */
router.get('/orders', authorize(['ADMIN', 'SALES_AGENT']), ordersController.getAllOrders);

/**
 * @route   GET /api/admin/orders/:id
 * @desc    Get order details (read-only view)
 * @access  Private (Admin, Sales Agent)
 */
router.get('/orders/:id', authorize(['ADMIN', 'SALES_AGENT']), ordersController.getOrderById);

/**
 * @route   PATCH /api/admin/orders/:id/status
 * @desc    Update order status (fulfillment only)
 * @access  Private (Admin, Inventory Manager)
 */
router.patch('/orders/:id/status', authorize(['ADMIN', 'INVENTORY_MANAGER']), ordersController.updateOrderStatus);

/**
 * @route   POST /api/admin/orders/:id/refund
 * @desc    Issue refund (financial operation)
 * @access  Private (Admin only)
 */
router.post('/orders/:id/refund', authorize(['ADMIN']), ordersController.refundOrder);

export default router;

// ⚠️ NOTES ON RBAC:
// - SALES_AGENT: Can view orders (no modification)
// - INVENTORY_MANAGER: Can update fulfillment status only
// - ADMIN: Full access including refunds
// This prevents scope creep and enforces separation of duties
