// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: ORDER MANAGEMENT CONTROLLER (ENHANCED)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Extended order operations with business logic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import adminOrdersService from '../services/admin.orders.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AdminOrdersController {
  /**
   * Get all orders with advanced filtering
   * GET /api/admin/orders
   * Query: status, userId, page, limit, dateFrom, dateTo, search
   */
  getAllOrders = asyncHandler(async (req, res) => {
    const { status, userId, page = 1, limit = 50, dateFrom, dateTo, search } = req.query;

    const result = await adminOrdersService.getAllOrders({
      status,
      userId,
      page: parseInt(page),
      limit: parseInt(limit),
      dateFrom,
      dateTo,
      search
    });

    res.json(success(result, 'Orders retrieved successfully'));
  });

  /**
   * Get order details
   * GET /api/admin/orders/:orderId
   */
  getOrderById = asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await adminOrdersService.getOrderById(orderId);

    res.json(success(order, 'Order retrieved successfully'));
  });

  /**
   * Update order status
   * PATCH /api/admin/orders/:orderId/status
   * Body: status, notes
   */
  updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const order = await adminOrdersService.updateOrderStatus(
      orderId,
      status,
      notes,
      req.user.id
    );

    res.json(success(order, 'Order status updated successfully'));
  });

  /**
   * Cancel order with stock rollback
   * POST /api/admin/orders/:orderId/cancel
   * Body: reason, notes
   */
  cancelOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason, notes } = req.body;

    const order = await adminOrdersService.cancelOrder(
      orderId,
      { reason, notes },
      req.user.id
    );

    res.json(success(order, 'Order cancelled successfully'));
  });

  /**
   * Process refund
   * POST /api/admin/orders/:orderId/refund
   * Body: reason, notes, refundAmount (optional)
   */
  processRefund = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason, notes, refundAmount } = req.body;

    const result = await adminOrdersService.processRefund(
      orderId,
      { reason, notes, refundAmount },
      req.user.id
    );

    res.json(success(result, 'Refund processed successfully'));
  });

  /**
   * Add order note
   * POST /api/admin/orders/:orderId/notes
   * Body: note, isInternal
   */
  addOrderNote = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { note, isInternal = true } = req.body;

    const result = await adminOrdersService.addOrderNote(
      orderId,
      note,
      isInternal,
      req.user.id
    );

    res.status(201).json(success(result, 'Order note added successfully'));
  });

  /**
   * Get order history and timeline
   * GET /api/admin/orders/:orderId/history
   */
  getOrderHistory = asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const history = await adminOrdersService.getOrderHistory(orderId);

    res.json(success(history, 'Order history retrieved successfully'));
  });

  /**
   * Get order by order number
   * GET /api/admin/orders/number/:orderNumber
   */
  getOrderByNumber = asyncHandler(async (req, res) => {
    const { orderNumber } = req.params;

    const order = await adminOrdersService.getOrderByNumber(orderNumber);

    res.json(success(order, 'Order retrieved successfully'));
  });

  /**
   * Export orders to CSV
   * GET /api/admin/orders/export/csv
   * Query: status, dateFrom, dateTo
   */
  exportOrders = asyncHandler(async (req, res) => {
    const { status, dateFrom, dateTo } = req.query;

    const csvData = await adminOrdersService.exportOrdersCSV({
      status,
      dateFrom,
      dateTo
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csvData);
  });

  /**
   * Get orders dashboard (KPIs, charts)
   * GET /api/admin/orders/dashboard/summary
   * Query: period (day, week, month, year)
   */
  getOrdersDashboard = asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    const dashboard = await adminOrdersService.getOrdersDashboard(period);

    res.json(success(dashboard, 'Orders dashboard retrieved successfully'));
  });

  /**
   * Get abnormal orders (failed payments, stuck status, etc.)
   * GET /api/admin/orders/abnormal/list
   */
  getAbnormalOrders = asyncHandler(async (req, res) => {
    const result = await adminOrdersService.getAbnormalOrders();

    res.json(success(result, 'Abnormal orders retrieved successfully'));
  });

  /**
   * Create manual order (admin-initiated)
   * POST /api/admin/orders/create
   * Body: userId, items, shippingAddress, billingAddress, notes
   */
  createManualOrder = asyncHandler(async (req, res) => {
    const { userId, items, shippingAddress, billingAddress, notes } = req.body;

    const order = await adminOrdersService.createManualOrder(
      {
        userId,
        items,
        shippingAddress,
        billingAddress,
        notes
      },
      req.user.id
    );

    res.status(201).json(success(order, 'Manual order created successfully'));
  });
}

export default new AdminOrdersController();
