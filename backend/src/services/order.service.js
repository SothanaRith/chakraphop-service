// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORDER MANAGEMENT SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRITICAL: Handles order lifecycle with stock reservation
// 
// Order Flow:
// 1. Create Order (PENDING) → Reserve stock
// 2. Process Payment → Update status to PAID
// 3. Fulfill Order → PROCESSING → SHIPPED → DELIVERED
// 4. Handle Failures → Cancel order → Release stock
//
// Key Principles:
// - Stock is reserved BEFORE payment
// - Stock is only permanently deducted after successful payment
// - Failed payments trigger automatic stock release
// - All state transitions are logged for audit
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { randomUUID } from 'crypto';
import { withTransactionRetry } from '../db/index.js';
import {
  countOrdersBetween,
  getOrderById as fetchOrderById,
  getOrderItems,
  getOrderPayments,
  getOrderStatusHistory,
  insertOrder,
  insertOrderItems,
  insertOrderStatusHistory,
  insertPayment,
  insertRefund,
  listOrdersByUser,
  countOrdersByUser,
  updateOrder,
} from '../repositories/order.repository.js';
import { deleteCartItemsByUser, getCartItemsByUserId } from '../repositories/cart.repository.js';
import { getDeliveryMethodById } from '../repositories/delivery.repository.js';
import {
  insertDeliveryTracking,
  insertDeliveryStatusHistory,
} from '../repositories/delivery.repository.js';
import Order from '../models/order.model.js';
import inventoryService from './inventory.service.js';
import { 
  NotFoundError, 
  ValidationError, 
  InsufficientStockError,
  ConcurrencyError 
} from '../utils/errors.js';
import logger from '../config/logger.js';
import deliveryService from './delivery.service.js';

class OrderService {

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CREATE ORDER FROM CART
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 1. Validate cart items and stock availability
   * 2. Calculate totals
   * 3. Create order in PENDING status
   * 4. Reserve stock
   * 5. Clear cart
   */
  async createOrderFromCart(userId, shippingAddressId, paymentMethod, customerNotes = null) {
    return withTransactionRetry(async (connection) => {
      const cartItems = await getCartItemsByUserId(userId);

      if (!cartItems || cartItems.length === 0) {
        throw new ValidationError('Cart is empty');
      }

      for (const item of cartItems) {
        if (item.productStatus !== 'ACTIVE') {
          throw new ValidationError(
            `Product "${item.productName}" is no longer available`
          );
        }
        if (!item.isActive) {
          throw new ValidationError(
            `Variant ${item.sku} is no longer available`
          );
        }
      }

      const stockCheck = await inventoryService.checkAvailability(
        cartItems.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );

      const unavailableItems = stockCheck.filter(item => !item.available);
      if (unavailableItems.length > 0) {
        throw new InsufficientStockError('Some items are out of stock', unavailableItems);
      }

      let subtotal = 0;
      const orderItems = [];

      for (const cartItem of cartItems) {
        const itemTotal = Number(cartItem.currentPrice) * cartItem.quantity;
        subtotal += Number(itemTotal);

        orderItems.push({
          variantId: cartItem.variantId,
          quantity: cartItem.quantity,
          priceAtPurchase: cartItem.currentPrice,
          subtotal: itemTotal,
          productName: cartItem.productName,
          variantSku: cartItem.sku,
          variantAttributes: cartItem.attributes,
        });
      }

      const shippingCost = subtotal > 50 ? 0 : 10;
      const discount = 0;
      const { tax, total } = Order.calculateTotals({
        subtotal,
        taxRate: 0.1,
        shippingCost,
        discount,
      });

      const orderNumber = await this._generateOrderNumber();
      const orderId = randomUUID();

      const order = await insertOrder(connection, {
        id: orderId,
        orderNumber,
        userId,
        status: 'PENDING',
        subtotal,
        tax,
        shippingCost,
        discount,
        total,
        shippingAddressId,
        customerNotes,
      });

      await insertOrderItems(connection, orderId, orderItems);
      await deleteCartItemsByUser(userId);
      await insertOrderStatusHistory(connection, {
        orderId,
        toStatus: 'PENDING',
        notes: 'Order created from cart',
      });

      const items = await getOrderItems(orderId);

      logger.info('Order created', {
        orderId,
        orderNumber: order.orderNumber,
        userId,
        total: order.total,
        itemCount: orderItems.length,
      });

      return { ...order, items };
    }, {
      isolationLevel: 'SERIALIZABLE'
    });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CONFIRM ORDER & RESERVE STOCK
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Called after order creation, before payment
   * This is where stock is actually reserved
   * CRITICAL: Wrapped in SERIALIZABLE transaction to prevent race conditions
   */
  async confirmOrder(orderId, userId) {
    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.userId !== userId) {
        throw new ValidationError('Unauthorized access to order');
      }

      const orderModel = Order.fromData(order);
      orderModel.assertCanConfirm();

      const items = await getOrderItems(orderId);
      const stockItems = items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      try {
        await inventoryService.reserveStock(stockItems, orderId, userId, connection);

        logger.info('Order confirmed and stock reserved', {
          orderId,
          orderNumber: order.orderNumber,
        });

        return { ...order, items };
      } catch (error) {
        logger.error('Stock reservation failed for order', {
          orderId,
          error: error.message,
        });
        throw error;
      }
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * PROCESS PAYMENT SUCCESS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async processPaymentSuccess(orderId, paymentData) {
    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      const orderModel = Order.fromData(order);
      orderModel.assertCanProcessPayment();

      await insertPayment(connection, {
        orderId,
        amount: order.total,
        method: paymentData.method,
        status: 'COMPLETED',
        transactionId: paymentData.transactionId,
        gatewayResponse: JSON.stringify(paymentData.gatewayResponse),
        processedAt: new Date(),
      });

      await updateOrder(connection, orderId, {
        status: 'PAID',
        paidAt: new Date(),
      });

      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: 'PENDING',
        toStatus: 'PAID',
        notes: `Payment successful. Transaction ID: ${paymentData.transactionId}`,
      });

      const items = await getOrderItems(orderId);
      const payments = await getOrderPayments(orderId);

      logger.info('Payment processed successfully', {
        orderId,
        orderNumber: order.orderNumber,
        amount: order.total,
        transactionId: paymentData.transactionId,
      });

      return { ...order, status: 'PAID', paidAt: new Date(), items, payments };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * PROCESS PAYMENT FAILURE
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Critical: Must release reserved stock & validate authorization
   */
  async processPaymentFailure(orderId, userId, failureReason) {
    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.userId !== userId) {
        throw new ValidationError('Unauthorized: Cannot process payment failure for another user\'s order');
      }

      const items = await getOrderItems(orderId);
      const stockItems = items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      await inventoryService.releaseStock(
        stockItems,
        orderId,
        `Payment failed: ${failureReason}`,
        userId,
        connection
      );

      await updateOrder(connection, orderId, {
        status: 'PAYMENT_FAILED',
      });

      await insertPayment(connection, {
        orderId,
        amount: order.total,
        method: 'UNKNOWN',
        status: 'FAILED',
        failureReason,
        failedAt: new Date(),
      });

      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: 'PAYMENT_FAILED',
        notes: `Payment failed: ${failureReason}`,
      });

      logger.warn('Payment failed, stock released', {
        orderId,
        orderNumber: order.orderNumber,
        reason: failureReason,
      });

      return { ...order, status: 'PAYMENT_FAILED', items };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CANCEL ORDER
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async cancelOrder(orderId, userId, reason) {
    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (userId && order.userId !== userId) {
        throw new ValidationError('Unauthorized: Cannot cancel another user\'s order');
      }

      const orderModel = Order.fromData(order);
      orderModel.assertCanCancel();

      const items = await getOrderItems(orderId);

      if (['PENDING', 'PAID', 'PROCESSING'].includes(order.status)) {
        const stockItems = items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }));

        await inventoryService.releaseStock(
          stockItems,
          orderId,
          `Order cancelled: ${reason}`,
          userId,
          connection
        );
      }

      await updateOrder(connection, orderId, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });

      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: 'CANCELLED',
        notes: `Cancelled: ${reason}`,
        changedById: userId,
      });

      logger.info('Order cancelled', {
        orderId,
        orderNumber: order.orderNumber,
        reason,
        cancelledBy: userId,
      });

      return { ...order, status: 'CANCELLED', cancelledAt: new Date(), items };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * UPDATE ORDER STATUS (ADMIN)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async updateOrderStatus(orderId, newStatus, notes, updatedBy) {
    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      const orderModel = Order.fromData(order);
      orderModel.assertCanTransitionTo(newStatus);

      const updateData = { status: newStatus };

      if (newStatus === 'SHIPPED' && !order.shippedAt) {
        updateData.shippedAt = new Date();
      } else if (newStatus === 'DELIVERED' && !order.deliveredAt) {
        updateData.deliveredAt = new Date();
      }

      await updateOrder(connection, orderId, updateData);

      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: newStatus,
        notes,
        changedById: updatedBy,
      });

      const items = await getOrderItems(orderId);
      const payments = await getOrderPayments(orderId);

      logger.info('Order status updated', {
        orderId,
        orderNumber: order.orderNumber,
        from: order.status,
        to: newStatus,
        updatedBy,
      });

      return { ...order, ...updateData, items, payments };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * HELPER: Generate unique order number
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async _generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Count orders today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const result = await countOrdersBetween(startOfDay, endOfDay);
    const todayCount = result?.total || 0;
    const sequence = String(Number(todayCount) + 1).padStart(4, '0');
    return `ORD-${year}${month}${day}-${sequence}`;
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * GET ORDER BY ID
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async getOrderById(orderId, userId = null, isAdmin = false) {
    const order = await fetchOrderById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Authorization check
    if (!isAdmin && userId && order.userId !== userId) {
      throw new ValidationError('Unauthorized access to order');
    }

    const [items, payments, statusHistory] = await Promise.all([
      getOrderItems(orderId),
      getOrderPayments(orderId),
      getOrderStatusHistory(orderId)
    ]);

    return { ...order, items, payments, statusHistory };
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * GET USER ORDERS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async getUserOrders(userId, page = 1, limit = 10) {
    const [orders, totalResult] = await Promise.all([
      listOrdersByUser(userId, page, limit),
      countOrdersByUser(userId)
    ]);

    const detailedOrders = await Promise.all(
      orders.map(async (order) => {
        const items = await getOrderItems(order.id);
        return { ...order, items };
      })
    );

    const total = totalResult?.total || 0;

    return {
      orders: detailedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * REFUND ORDER (ADMIN)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 1. Verify order exists and is in refundable status
   * 2. Release reserved/sold stock
   * 3. Create refund record
   * 4. Update order status to REFUNDED
   * 5. Log refund for audit trail
   */
  async refundOrder(orderId, reason = null, adminUserId = null) {
    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      const orderModel = Order.fromData(order);
      orderModel.assertCanRefund();

      const items = await getOrderItems(orderId);
      const stockItems = items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      await inventoryService.releaseStock(
        stockItems,
        orderId,
        `Refund issued${reason ? `: ${reason}` : ''}`,
        adminUserId,
        connection
      );

      await updateOrder(connection, orderId, {
        status: 'REFUNDED',
        refundedAt: new Date(),
      });

      await insertRefund(connection, {
        orderId,
        amount: order.total,
        reason: reason || 'Manual refund by admin',
        refundedBy: adminUserId,
        refundedAt: new Date(),
      });

      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: 'REFUNDED',
        notes: `Refund issued${reason ? `: ${reason}` : ''}`,
      });

      logger.info('Order refunded successfully', {
        orderId,
        orderNumber: order.orderNumber,
        amount: order.total,
        reason: reason || 'Manual refund',
        refundedBy: adminUserId,
      });

      return { ...order, status: 'REFUNDED', refundedAt: new Date(), items };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * SELECT DELIVERY METHOD FOR ORDER
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Called during checkout to select delivery method
   * Updates order with delivery method and creates tracking
   */
  async selectDeliveryMethod(orderId, userId, deliveryMethodId) {
    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.userId !== userId) {
        throw new ValidationError('Unauthorized access to order');
      }

      const orderModel = Order.fromData(order);
      orderModel.assertCanConfirm();

      const method = await getDeliveryMethodById(deliveryMethodId);

      if (!method) {
        throw new NotFoundError('Delivery method not found');
      }

      if (!method.isActive) {
        throw new ValidationError('This delivery method is no longer available');
      }

      const isAvailable = await deliveryService._checkLocationAvailability(
        deliveryMethodId,
        order.shippingCountry,
        order.shippingState,
        order.shippingCity
      );

      if (!isAvailable) {
        throw new ValidationError(
          'This delivery method is not available for your shipping address'
        );
      }

      const estimatedDelivery = deliveryService._calculateEstimatedDeliveryDate(
        method.estimatedDaysMin,
        method.estimatedDays
      );

      const newTotal = Number(order.subtotal) + Number(order.tax) + Number(method.basePrice) - Number(order.discount);

      await updateOrder(connection, orderId, {
        deliveryMethodId,
        shippingCost: Number(method.basePrice),
        total: newTotal,
        estimatedDelivery: estimatedDelivery.latest,
        deliveryStatus: 'PENDING',
        deliveryStatusUpdatedAt: new Date(),
      });

      const trackingId = randomUUID();
      const tracking = await insertDeliveryTracking(connection, trackingId, orderId);

      await insertDeliveryStatusHistory(connection, {
        orderId,
        trackingId: tracking.id,
        toStatus: 'PENDING',
        reason: 'Delivery method selected',
        notes: `${method.name} - Estimated delivery: ${estimatedDelivery.latest.toLocaleDateString()}`
      });

      logger.info('Delivery method selected for order', {
        orderId,
        orderNumber: order.orderNumber,
        deliveryMethodId,
        methodName: method.name,
        newTotal,
      });

      return {
        order: { ...order, deliveryMethodId, shippingCost: Number(method.basePrice), total: newTotal },
        tracking,
      };
    }, {
      isolationLevel: 'SERIALIZABLE'
    });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * GET ORDER WITH DELIVERY STATUS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async getOrderWithDelivery(orderId, userId) {
    const order = await fetchOrderById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Verify authorization
    if (order.userId !== userId && userId !== 'admin') {
      throw new ValidationError('Unauthorized access to order');
    }

    const [items, payments, statusHistory] = await Promise.all([
      getOrderItems(orderId),
      getOrderPayments(orderId),
      getOrderStatusHistory(orderId)
    ]);

    const tracking = await deliveryService.getCustomerDeliveryStatus(orderId);

    return {
      ...order,
      items,
      payments,
      statusHistory,
      deliveryTracking: tracking
    };
  }
}

export default new OrderService();
