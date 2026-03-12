// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  countUnreadNotifications,
  countUserNotifications,
  deleteUserNotification,
  getUserEmailById,
  insertEmailLog,
  insertUserNotification,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../repositories/notification.repository.js';
import { getOrderById } from '../repositories/order.repository.js';
import { getProductById } from '../repositories/product.repository.js';
import { listUsersByRoles } from '../repositories/user.repository.js';

/**
 * Send notification to user
 */
async function sendNotification({
  userId,
  type,
  channel = 'EMAIL',
  subject = null,
  body,
  relatedEntityType = null,
  relatedEntityId = null
}) {
  // Create notification record
  const notification = await insertUserNotification({
    userId,
    type,
    channel,
    subject,
    body,
    relatedEntityType,
    relatedEntityId
  });
  
  // Actually send based on channel
  if (channel === 'EMAIL') {
    await sendEmail({
      userId,
      subject: subject || getDefaultSubject(type),
      body
    });
  }
  // Add SMS, PUSH later
  
  return notification;
}

/**
 * Send email
 */
async function sendEmail({ userId, subject, body }) {
  const user = await getUserEmailById(userId);
  
  if (!user) {
    return;
  }
  
  // Log email
  await insertEmailLog({
    recipient: user.email,
    subject,
    body,
    status: 'PENDING',
    userId
  });
  
  // TODO: Integrate with email provider (SendGrid, AWS SES, etc.)
  console.log(`[EMAIL] To: ${user.email}, Subject: ${subject}`);
  
  // For now, mark as sent immediately
  // In production, this would be handled by email service webhook/callback
}

/**
 * Send order notification
 */
async function sendOrderNotification(order, type) {
  const templates = {
    ORDER_CONFIRMATION: {
      subject: `Order Confirmation - ${order.orderNumber}`,
      body: `Thank you for your order! Order #${order.orderNumber} has been confirmed. Total: $${order.total}`
    },
    ORDER_SHIPPED: {
      subject: `Your Order Has Shipped - ${order.orderNumber}`,
      body: `Great news! Your order #${order.orderNumber} has been shipped. Tracking: ${order.trackingNumber || 'N/A'}`
    },
    ORDER_DELIVERED: {
      subject: `Order Delivered - ${order.orderNumber}`,
      body: `Your order #${order.orderNumber} has been delivered. Thank you for shopping with us!`
    },
    ORDER_CANCELLED: {
      subject: `Order Cancelled - ${order.orderNumber}`,
      body: `Your order #${order.orderNumber} has been cancelled. If you have any questions, please contact support.`
    }
  };
  
  const template = templates[type];
  
  if (!template) {
    return;
  }
  
  return sendNotification({
    userId: order.userId,
    type,
    channel: 'EMAIL',
    subject: template.subject,
    body: template.body,
    relatedEntityType: 'Order',
    relatedEntityId: order.id
  });
}

/**
 * Send payment notification
 */
async function sendPaymentNotification(payment, type) {
  const order = await getOrderById(payment.orderId);
  
  if (!order) {
    return;
  }
  
  const templates = {
    PAYMENT_SUCCESS: {
      subject: `Payment Confirmed - Order ${order.orderNumber}`,
      body: `Your payment of $${payment.amount} has been processed successfully for order #${order.orderNumber}.`
    },
    PAYMENT_FAILED: {
      subject: `Payment Failed - Order ${order.orderNumber}`,
      body: `We were unable to process your payment for order #${order.orderNumber}. Please update your payment method.`
    }
  };
  
  const template = templates[type];
  
  if (!template) {
    return;
  }
  
  return sendNotification({
    userId: order.userId,
    type,
    channel: 'EMAIL',
    subject: template.subject,
    body: template.body,
    relatedEntityType: 'Payment',
    relatedEntityId: payment.id
  });
}

/**
 * Send low stock alert (to admins)
 */
async function sendLowStockAlert(variant) {
  const admins = await listUsersByRoles(['SUPER_ADMIN', 'ADMIN', 'INVENTORY_MANAGER']);
  
  const product = await getProductById(variant.productId);
  if (!product) {
    return [];
  }
  
  const body = `Low stock alert: ${product.name} (SKU: ${variant.sku}) - ${variant.stockQuantity} units remaining (threshold: ${variant.lowStockThreshold})`;
  
  const notifications = admins.map(admin => 
    sendNotification({
      userId: admin.id,
      type: 'STOCK_ALERT',
      channel: 'EMAIL',
      subject: 'Low Stock Alert',
      body,
      relatedEntityType: 'ProductVariant',
      relatedEntityId: variant.id
    })
  );
  
  return Promise.all(notifications);
}

/**
 * Get user notifications
 */
async function getUserNotifications({ userId, isRead = null, page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    listUserNotifications({ userId, isRead, limit, offset: skip }),
    countUserNotifications({ userId, isRead }),
    countUnreadNotifications(userId)
  ]);
  
  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  };
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId) {
  await markNotificationRead(notificationId, userId);
  
  return { success: true };
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(userId) {
  await markAllNotificationsRead(userId);
  
  return { success: true };
}

/**
 * Delete notification
 */
async function deleteNotification(notificationId, userId) {
  await deleteUserNotification(notificationId, userId);
  
  return { success: true };
}

/**
 * Get default subject for notification type
 */
function getDefaultSubject(type) {
  const subjects = {
    ORDER_CONFIRMATION: 'Order Confirmation',
    ORDER_SHIPPED: 'Your Order Has Shipped',
    ORDER_DELIVERED: 'Order Delivered',
    ORDER_CANCELLED: 'Order Cancelled',
    PAYMENT_SUCCESS: 'Payment Confirmed',
    PAYMENT_FAILED: 'Payment Failed',
    STOCK_ALERT: 'Low Stock Alert',
    PROMOTION: 'Special Offer',
    SYSTEM: 'System Notification'
  };
  
  return subjects[type] || 'Notification';
}

export {
  sendNotification,
  sendOrderNotification,
  sendPaymentNotification,
  sendLowStockAlert,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
