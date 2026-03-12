// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELIVERY & SHIPPING SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRITICAL: Manages delivery methods, tracking, and status lifecycle
//
// Delivery Flow:
// 1. Get available delivery methods for checkout
// 2. Validate delivery method selection
// 3. Create delivery tracking after order confirmation
// 4. Update delivery status through lifecycle
// 5. Provide customer with tracking information
//
// Key Principles:
// - Delivery cost is locked at order time (immutable after creation)
// - Status changes are sequential and validated
// - All changes logged for audit trail
// - Availability rules prevent invalid deliveries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { randomUUID } from 'crypto';
import { withTransactionRetry } from '../db/index.js';
import {
  createDeliveryMethod,
  getActiveDeliveryMethods,
  getAvailabilityRule,
  getDeliveryMethodById,
  getDeliveryMethodByName,
  getDeliveryStatusHistory,
  getDeliveryTrackingByOrderId,
  insertDeliveryStatusHistory,
  insertDeliveryTracking,
  listAvailabilityRules,
  listDeliveryMethods,
  updateDeliveryMethod,
  updateDeliveryTracking,
  updateOrderDeliveryStatus,
  upsertAvailabilityRule,
} from '../repositories/delivery.repository.js';
import { getOrderById as fetchOrderById } from '../repositories/order.repository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../config/logger.js';
import Delivery from '../models/delivery.model.js';

class DeliveryService {
  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * GET AVAILABLE DELIVERY METHODS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Returns delivery methods available for the given address and order amount
   */
  async getAvailableDeliveryMethods(address, orderSubtotal) {
    if (!address || !address.state || !address.country) {
      throw new ValidationError('Complete shipping address required');
    }

    if (!orderSubtotal || orderSubtotal <= 0) {
      throw new ValidationError('Valid order subtotal required');
    }

    try {
      // Get all active delivery methods
      const methods = await getActiveDeliveryMethods();

      if (methods.length === 0) {
        throw new Error('No delivery methods configured');
      }

      // Filter by availability rules and order amount
      const available = [];

      for (const method of methods) {
        // Check if order meets minimum amount requirement
        if (orderSubtotal < method.minOrderAmount) {
          continue;
        }

        // Check location availability
        const isAvailable = await this._checkLocationAvailability(
          method.id,
          address.country,
          address.state,
          address.city
        );

        if (isAvailable) {
          // Calculate estimated delivery date
          const estimatedDate = this._calculateEstimatedDeliveryDate(
            method.estimatedDaysMin,
            method.estimatedDays
          );

          available.push({
            id: method.id,
            name: method.name,
            type: method.type,
            description: method.description,
            price: Number(method.basePrice),
            estimatedDays: `${method.estimatedDaysMin}-${method.estimatedDays}`,
            estimatedDeliveryDate: estimatedDate
          });
        }
      }

      if (available.length === 0) {
        logger.warn('No delivery methods available for location', {
          state: address.state,
          country: address.country
        });
        throw new ValidationError(
          'Delivery is not available to your location. Please contact support.'
        );
      }

      return available;
    } catch (error) {
      logger.error('Error fetching delivery methods', error);
      throw error;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CHECK LOCATION AVAILABILITY
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async _checkLocationAvailability(deliveryMethodId, country, state, city) {
    // Check for specific city rule first
    const cityRule = await getAvailabilityRule(deliveryMethodId, country, state, city || null);

    if (cityRule) {
      return cityRule.isAvailable;
    }

    // Check for state rule
    const stateRule = await getAvailabilityRule(deliveryMethodId, country, state, null);

    if (stateRule) {
      return stateRule.isAvailable;
    }

    // Check for country-wide rule
    const countryRule = await getAvailabilityRule(deliveryMethodId, country, null, null);

    if (countryRule) {
      return countryRule.isAvailable;
    }

    // If no specific rule exists, assume available
    return true;
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CALCULATE ESTIMATED DELIVERY DATE
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  _calculateEstimatedDeliveryDate(minDays, maxDays) {
    const today = new Date();
    // Start from next business day (skip weekends)
    let startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 1);

    // Skip weekends
    while (startDate.getDay() === 0 || startDate.getDay() === 6) {
      startDate.setDate(startDate.getDate() + 1);
    }

    // Add max days to get delivery date
    const deliveryDate = new Date(startDate);
    deliveryDate.setDate(deliveryDate.getDate() + maxDays - 1);

    return {
      earliest: new Date(startDate),
      latest: deliveryDate
    };
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * VALIDATE DELIVERY METHOD SELECTION
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async validateDeliveryMethod(deliveryMethodId) {
    const method = await getDeliveryMethodById(deliveryMethodId);

    if (!method) {
      throw new NotFoundError('Delivery method not found');
    }

    if (!method.isActive) {
      throw new ValidationError('This delivery method is no longer available');
    }

    return method;
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CREATE DELIVERY TRACKING AFTER ORDER CONFIRMATION
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Called after order is created and delivery method is selected
   */
  async createDeliveryTracking(orderId, deliveryMethodId) {
    return withTransactionRetry(async (connection) => {
      const method = await getDeliveryMethodById(deliveryMethodId);

      if (!method) {
        throw new NotFoundError('Delivery method not found');
      }

      const trackingId = randomUUID();
      const tracking = await insertDeliveryTracking(connection, trackingId, orderId);

      await insertDeliveryStatusHistory(connection, {
        orderId,
        trackingId: tracking.id,
        toStatus: 'PENDING',
        reason: 'Order placed',
        notes: 'Delivery tracking initialized',
      });

      logger.info('Delivery tracking created', {
        orderId,
        trackingId: tracking.id,
        deliveryMethodId,
      });

      return tracking;
    }, { isolationLevel: 'READ COMMITTED' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * UPDATE DELIVERY STATUS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Admin function to update delivery status with full audit trail
   */
  async updateDeliveryStatus(orderId, newStatus, options = {}) {
    const { trackingNumber, carrier, carrierUrl, reason = null, notes = null, adminId = null } = options;

    // Validate status is in allowed list
    const validStatuses = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      throw new ValidationError(`Invalid delivery status: ${newStatus}`);
    }

    return withTransactionRetry(async (connection) => {
      const order = await fetchOrderById(orderId, connection);
      const tracking = await getDeliveryTrackingByOrderId(orderId);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (!tracking) {
        throw new ValidationError('Delivery tracking not found for this order');
      }

      const currentStatus = tracking.currentStatus;
      const deliveryModel = Delivery.fromData({ currentStatus });
      deliveryModel.assertCanUpdateStatus(newStatus);

      await updateDeliveryTracking(connection, tracking.id, {
        currentStatus: newStatus,
        lastStatusUpdate: new Date(),
        ...(trackingNumber && { trackingNumber }),
        ...(carrier && { carrier }),
        ...(carrierUrl && { carrierUrl }),
        ...(newStatus === 'SHIPPED' && !tracking.shippedAt && { shippedAt: new Date() }),
        ...(newStatus === 'OUT_FOR_DELIVERY' && !tracking.outForDeliveryAt && { outForDeliveryAt: new Date() }),
        ...(newStatus === 'DELIVERED' && !tracking.deliveredAt && { deliveredAt: new Date() }),
        ...(newStatus === 'FAILED' && !tracking.failedAt && { failedAt: new Date() }),
        ...(newStatus === 'RETURNED' && !tracking.returnedAt && { returnedAt: new Date() })
      });

      await updateOrderDeliveryStatus(connection, orderId, {
        deliveryStatus: newStatus,
        deliveryStatusUpdatedAt: new Date(),
        ...(newStatus === 'DELIVERED' && { deliveredAt: new Date() })
      });

      await insertDeliveryStatusHistory(connection, {
        orderId,
        trackingId: tracking.id,
        fromStatus: currentStatus,
        toStatus: newStatus,
        changedBy: adminId,
        reason,
        notes
      });

      logger.info('Delivery status updated', {
        orderId,
        fromStatus: currentStatus,
        toStatus: newStatus,
        trackingNumber: trackingNumber || tracking.trackingNumber,
        adminId
      });

      return { ...tracking, currentStatus: newStatus };
    }, { isolationLevel: 'READ COMMITTED' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * VALIDATE STATUS TRANSITION
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Ensure status changes follow logical sequence
   */
  _validateStatusTransition(fromStatus, toStatus) {
    const deliveryModel = Delivery.fromData({ currentStatus: fromStatus });
    deliveryModel.assertCanUpdateStatus(toStatus);
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * GET DELIVERY TRACKING FOR CUSTOMER
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Returns customer-facing delivery information
   */
  async getCustomerDeliveryStatus(orderId) {
    const tracking = await getDeliveryTrackingByOrderId(orderId);

    if (!tracking) {
      throw new NotFoundError('Delivery tracking not found');
    }

    const order = await fetchOrderById(orderId);
    const statusHistory = await getDeliveryStatusHistory(orderId);
    const deliveryMethod = order.deliveryMethodId
      ? await getDeliveryMethodById(order.deliveryMethodId)
      : null;

    return {
      orderNumber: order.orderNumber,
      currentStatus: tracking.currentStatus,
      trackingNumber: tracking.trackingNumber,
      carrier: tracking.carrier,
      carrierUrl: tracking.carrierUrl,
      deliveryMethod,
      shippingAddress: {
        fullName: order.shippingFullName,
        phone: order.shippingPhone,
        addressLine1: order.shippingAddressLine1,
        addressLine2: order.shippingAddressLine2,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
      },
      timeline: {
        shipped: tracking.shippedAt,
        outForDelivery: tracking.outForDeliveryAt,
        delivered: tracking.deliveredAt,
        failed: tracking.failedAt,
        returned: tracking.returnedAt
      },
      statusHistory,
      lastUpdate: tracking.lastStatusUpdate
    };
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * ADMIN: GET ALL DELIVERY METHODS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async getAllDeliveryMethods(filters = {}) {
    const { active = null, type = null } = filters;

    const methods = await listDeliveryMethods({ active, type });
    return Promise.all(
      methods.map(async (method) => ({
        ...method,
        availabilityRules: await listAvailabilityRules(method.id)
      }))
    );
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * ADMIN: CREATE DELIVERY METHOD
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async createDeliveryMethod(data) {
    const { name, type, basePrice, estimatedDaysMin, estimatedDays, description, minOrderAmount } = data;

    // Validate input
    if (!name || !type || !basePrice || !estimatedDaysMin || !estimatedDays) {
      throw new ValidationError('Missing required fields for delivery method');
    }

    if (estimatedDaysMin > estimatedDays) {
      throw new ValidationError('Minimum days must be less than or equal to estimated days');
    }

    if (basePrice < 0) {
      throw new ValidationError('Price cannot be negative');
    }

    // Check if method with same name already exists
    const existing = await getDeliveryMethodByName(name);

    if (existing) {
      throw new ValidationError(`Delivery method "${name}" already exists`);
    }

    const method = await createDeliveryMethod({
      name,
      type,
      basePrice,
      estimatedDaysMin,
      estimatedDays,
      description,
      minOrderAmount: minOrderAmount || 0
    });

    logger.info('Delivery method created', { methodId: method.id, name });
    return method;
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * ADMIN: UPDATE DELIVERY METHOD
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async updateDeliveryMethod(methodId, data) {
    const method = await getDeliveryMethodById(methodId);

    if (!method) {
      throw new NotFoundError('Delivery method not found');
    }

    const updated = await updateDeliveryMethod(methodId, {
      ...(data.name && { name: data.name }),
      ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
      ...(data.estimatedDaysMin && { estimatedDaysMin: data.estimatedDaysMin }),
      ...(data.estimatedDays && { estimatedDays: data.estimatedDays }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive ? 1 : 0 }),
      ...(data.minOrderAmount !== undefined && { minOrderAmount: data.minOrderAmount })
    });

    logger.info('Delivery method updated', { methodId, changes: Object.keys(data) });
    return updated;
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * ADMIN: SET AVAILABILITY RULES
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async setAvailabilityRule(deliveryMethodId, country, state, city, isAvailable) {
    const method = await getDeliveryMethodById(deliveryMethodId);

    if (!method) {
      throw new NotFoundError('Delivery method not found');
    }

    // Try to find existing rule
    return upsertAvailabilityRule(
      deliveryMethodId,
      country,
      state || null,
      city || null,
      isAvailable
    );
  }
}

export default new DeliveryService();
