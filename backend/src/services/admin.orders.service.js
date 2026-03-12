// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ORDERS SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Business logic for advanced order operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import crypto from 'node:crypto';
import inventoryService from './inventory.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../config/logger.js';
import { withTransaction } from '../db/index.js';
import {
  countOrders,
  getOrderById as getOrderByIdRepo,
  getOrderByNumber,
  insertOrderNote,
  listOrderItems,
  listOrderNotes,
  listOrderPayments,
  listOrderStatusHistory,
  listOrders,
  listOrdersByDateRangeAndStatuses,
  listOrdersByStatusSince,
  listOrdersForExport,
} from '../repositories/admin.orders.repository.js';
import {
  insertOrder,
  insertOrderItems,
  insertOrderStatusHistory,
  insertRefund,
  updateOrder,
} from '../repositories/order.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { getProductVariantById } from '../repositories/product.repository.js';
import { insertAddress } from '../repositories/address.repository.js';

class AdminOrdersService {
  /**
   * Get all orders with advanced filtering
   */
  async getAllOrders({ status, userId, page = 1, limit = 50, dateFrom, dateTo, search }) {
    const [orders, total] = await Promise.all([
      listOrders({
        status,
        userId,
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null,
        search,
        limit,
        offset: (page - 1) * limit,
      }),
      countOrders({
        status,
        userId,
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null,
        search,
      })
    ]);

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const [items, payments] = await Promise.all([
          listOrderItems(order.id),
          listOrderPayments(order.id)
        ]);

        return { ...order, items, payment: payments };
      })
    );

    return {
      orders: ordersWithDetails,
      pagination: {
        page,
        limit,
        total: total?.total || 0,
        totalPages: Math.ceil((total?.total || 0) / limit)
      }
    };
  }

  /**
   * Get order details
   */
  async getOrderById(orderId) {
    const order = await getOrderByIdRepo(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const [items, payments, statusHistory, notes] = await Promise.all([
      listOrderItems(orderId),
      listOrderPayments(orderId),
      listOrderStatusHistory(orderId),
      listOrderNotes(orderId)
    ]);

    return {
      ...order,
      items,
      payment: payments,
      statusHistory,
      notes
    };
  }

  /**
   * Update order status with validation
   */
  async updateOrderStatus(orderId, newStatus, notes, adminUserId) {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Validate status transition
    const validTransitions = {
      PENDING: ['PAYMENT_FAILED', 'PAID', 'CANCELLED'],
      PAID: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
      PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
      REFUNDED: []
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    await withTransaction(async (connection) => {
      await updateOrder(connection, orderId, { status: newStatus });
      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: newStatus,
        notes: notes || `Status changed to ${newStatus}`,
        changedById: adminUserId,
      });
    });

    logger.info('Order status updated', {
      orderId,
      fromStatus: order.status,
      toStatus: newStatus,
      updatedBy: adminUserId
    });

    return this.getOrderById(orderId);
  }

  /**
   * Cancel order with stock rollback (CRITICAL)
   */
  async cancelOrder(orderId, { reason, notes }, adminUserId) {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Cannot cancel already delivered or refunded orders
    if (['DELIVERED', 'REFUNDED'].includes(order.status)) {
      throw new ValidationError(`Cannot cancel order with status: ${order.status}`);
    }

    return await withTransaction(async (connection) => {
      // Release stock if order was paid
      if (order.status === 'PAID' || order.status === 'PROCESSING' || order.status === 'SHIPPED') {
        const stockItems = order.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity
        }));

        await inventoryService.releaseStock(
          stockItems,
          orderId,
          `Order cancelled: ${reason}`,
          adminUserId
        );
      }

      // Update order status
      await updateOrder(connection, orderId, {
        status: 'CANCELLED',
        cancelledAt: new Date()
      });

      // Log cancellation
      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: 'CANCELLED',
        notes: notes || `Cancelled: ${reason}`,
        changedById: adminUserId,
      });

      logger.info('Order cancelled by admin', {
        orderId,
        reason,
        cancelledBy: adminUserId
      });

      return this.getOrderById(orderId);
    });
  }

  /**
   * Process refund (CRITICAL - financial operation)
   */
  async processRefund(orderId, { reason, notes, refundAmount }, adminUserId) {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
      throw new ValidationError(`Cannot refund order with status: ${order.status}`);
    }

    const finalRefundAmount = refundAmount || order.total;

    if (finalRefundAmount <= 0 || finalRefundAmount > order.total) {
      throw new ValidationError(
        `Invalid refund amount. Order total: ${order.total}`
      );
    }

    return await withTransaction(async (connection) => {
      // Release stock
      const stockItems = order.items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity
      }));

      await inventoryService.releaseStock(
        stockItems,
        orderId,
        `Refund processed: ${reason}`,
        adminUserId
      );

      // Create refund record
      const refund = await insertRefund(connection, {
        orderId,
        amount: finalRefundAmount,
        reason: reason || 'Admin refund',
        refundedBy: adminUserId,
        refundedAt: new Date(),
      });

      // Update order status if full refund
      if (finalRefundAmount === order.total) {
        await updateOrder(connection, orderId, { status: 'REFUNDED', refundedAt: new Date() });
      }

      // Log refund
      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: 'REFUNDED',
        notes: notes || `Refund of ${finalRefundAmount}: ${reason}`,
        changedById: adminUserId,
      });

      logger.warn('Order refund processed', {
        orderId,
        refundAmount: finalRefundAmount,
        reason,
        refundedBy: adminUserId
      });

      return {
        refundId: refund?.id || null,
        orderId,
        amount: finalRefundAmount,
        status: 'PROCESSED'
      };
    });
  }

  /**
   * Add note to order
   */
  async addOrderNote(orderId, note, isInternal, adminUserId) {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const orderNote = await insertOrderNote({
      orderId,
      note,
      isInternal,
      createdBy: adminUserId
    });

    return orderNote;
  }

  /**
   * Get order history and timeline
   */
  async getOrderHistory(orderId) {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return {
      orderId,
      orderNumber: order.orderNumber,
      statusHistory: order.statusHistory,
      notes: order.notes,
      timeline: this._buildTimeline(order)
    };
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber) {
    const order = await getOrderByNumber(orderNumber);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const [items, payments] = await Promise.all([
      listOrderItems(order.id),
      listOrderPayments(order.id)
    ]);

    return { ...order, items, payment: payments };
  }

  /**
   * Export orders to CSV
   */
  async exportOrdersCSV({ status, dateFrom, dateTo }) {
    const orders = await listOrdersForExport({
      status,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
    });

    // Build CSV
    const headers = [
      'Order Number',
      'Customer Name',
      'Email',
      'Total',
      'Status',
      'Created Date',
      'Item Count'
    ];

    const rows = orders.map(o => [
      o.orderNumber,
      `${o.firstName} ${o.lastName}`,
      o.email,
      o.total,
      o.status,
      o.createdAt.toISOString(),
      o.itemCount || 0
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Get orders dashboard with KPIs
   */
  async getOrdersDashboard(period = 'month') {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const orders = await listOrdersByDateRangeAndStatuses(startDate, ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']);

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      period,
      startDate,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      statusBreakdown: {
        PROCESSING: orders.filter(o => o.status === 'PROCESSING').length,
        SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
        DELIVERED: orders.filter(o => o.status === 'DELIVERED').length
      }
    };
  }

  /**
   * Get abnormal orders (issues requiring attention)
   */
  async getAbnormalOrders() {
    const abnormal = [];

    // Failed payments stuck for more than 24 hours
    const failedPayments = await listOrdersByStatusSince(
      'PAYMENT_FAILED',
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    abnormal.push({
      category: 'FAILED_PAYMENTS_24H',
      count: failedPayments.length,
      orders: failedPayments
    });

    // Processing orders older than 7 days
    const oldProcessing = await listOrdersByStatusSince(
      'PROCESSING',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    abnormal.push({
      category: 'PROCESSING_7DAYS',
      count: oldProcessing.length,
      orders: oldProcessing
    });

    return abnormal;
  }

  /**
   * Create manual order (admin-initiated)
   */
  async createManualOrder({ userId, items, shippingAddress, billingAddress, notes }, adminUserId) {
    const user = await findUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return withTransaction(async (connection) => {
      const orderNumber = `ORD-${Date.now()}`;

      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const variant = await getProductVariantById(item.variantId);

        if (!variant) {
          throw new NotFoundError(`Variant ${item.variantId} not found`);
        }

        const itemTotal = Number(variant.price) * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
          priceAtPurchase: Number(variant.price),
          subtotal: itemTotal,
          productName: variant.productName,
          variantSku: variant.sku,
          variantAttributes: variant.attributes || '{}'
        });
      }

      const shippingAddressRecord = shippingAddress
        ? await insertAddress(userId, { ...shippingAddress, isDefault: false }, connection)
        : null;

      const orderId = crypto.randomUUID();
      await insertOrder(connection, {
        id: orderId,
        orderNumber,
        userId,
        status: 'PENDING',
        subtotal,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        total: subtotal,
        shippingAddressId: shippingAddressRecord?.id || null,
        customerNotes: notes || `Manual order created by admin`,
      });

      await insertOrderItems(connection, orderId, orderItems);
      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: null,
        toStatus: 'PENDING',
        notes: notes || `Manual order created by admin`,
        changedById: adminUserId,
      });

      if (notes) {
        await insertOrderNote({
          orderId,
          note: notes,
          isInternal: true,
          createdBy: adminUserId
        });
      }

      logger.info('Manual order created', {
        orderId,
        userId,
        total: subtotal,
        createdBy: adminUserId
      });

      return this.getOrderById(orderId);
    });
  }

  /**
   * Build timeline from order events
   */
  _buildTimeline(order) {
    const timeline = [];

    timeline.push({
      timestamp: order.createdAt,
      event: 'Order Created',
      status: order.status
    });

    if (order.statusHistory) {
      order.statusHistory.forEach(history => {
        timeline.push({
          timestamp: history.changedAt,
          event: `Status Changed: ${history.fromStatus} -> ${history.toStatus}`,
          notes: history.notes
        });
      });
    }

    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
}

export default new AdminOrdersService();
