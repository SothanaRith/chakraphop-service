// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORDERS CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import orderService from '../services/order.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class OrdersController {
  /**
   * Create order from cart
   * POST /api/orders
   */
  createOrder = asyncHandler(async (req, res) => {
    const { shippingAddressId, billingAddressId, notes } = req.body;

    const order = await orderService.createOrderFromCart(
      req.user.id,
      shippingAddressId,
      billingAddressId,
      notes
    );

    res.status(201).json(success(order, 'Order created successfully'));
  });

  /**
   * Confirm order (reserve stock before payment)
   * POST /api/orders/:id/confirm
   */
  confirmOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await orderService.confirmOrder(id, req.user.id);
    res.json(success(order, 'Order confirmed, stock reserved'));
  });

  /**
   * Process payment success
   * POST /api/orders/:id/payment-success
   */
  processPaymentSuccess = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentMethod, transactionId, amount } = req.body;

    const order = await orderService.processPaymentSuccess(id, {
      paymentMethod,
      transactionId,
      amount,
      method: paymentMethod
    });

    res.json(success(order, 'Payment processed successfully'));
  });

  /**
   * Process payment failure
   * POST /api/orders/:id/payment-failure
   */
  processPaymentFailure = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason, transactionId } = req.body;

    await orderService.processPaymentFailure(id, req.user.id, reason);

    res.json(success(null, 'Payment failure processed, stock released'));
  });

  /**
   * Cancel order
   * POST /api/orders/:id/cancel
   */
  cancelOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await orderService.cancelOrder(id, req.user.id, reason);

    res.json(success(order, 'Order cancelled successfully'));
  });

  /**
   * Get order by ID
   * GET /api/orders/:id
   */
  getOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await orderService.getOrderById(id, req.user.id);
    res.json(success(order));
  });

  /**
   * Get user orders
   * GET /api/orders
   */
  getUserOrders = asyncHandler(async (req, res) => {
    const { page, limit, status } = req.query;
    const result = await orderService.getUserOrders(req.user.id, { page, limit, status });
    res.json(success(result));
  });

  /**
   * Update order status (admin)
   * PATCH /api/orders/:id/status
   */
  updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = await orderService.updateOrderStatus(id, status, req.user.id);

    res.json(success(order, 'Order status updated'));
  });

  /**
   * Get all orders (admin)
   * GET /api/admin/orders
   */
  getAllOrders = asyncHandler(async (req, res) => {
    const result = await orderService.getAllOrders(req.query);
    res.json(success(result));
  });

  /**
   * Refund order (admin)
   * POST /api/admin/orders/:id/refund
   */
  refundOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await orderService.refundOrder(id, reason, req.user.id);

    res.json(success(order, 'Refund processed successfully'));
  });
}

export default new OrdersController();
