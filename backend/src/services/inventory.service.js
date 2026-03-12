// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVENTORY MANAGEMENT SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRITICAL BUSINESS LOGIC - Handle with extreme care
// 
// Key Features:
// - Transaction-safe stock updates (ACID compliance)
// - Optimistic locking to prevent race conditions
// - Immutable audit trail of all stock movements
// - Overselling prevention under high concurrency
// - Automatic rollback on failures
//
// Common Pitfalls Avoided:
// ✓ Lost updates (solved with optimistic locking + version field)
// ✓ Phantom reads (solved with database transactions)
// ✓ Negative stock (validation before commit)
// ✓ Missing audit trail (every change logged)
// ✓ Inconsistent state (transaction rollback on error)
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { withTransactionRetry } from '../db/index.js';
import {
  decrementStock,
  getLowStockAlerts as fetchLowStockAlerts,
  getStockHistory as fetchStockHistory,
  getVariantById,
  getVariantForUpdate,
  incrementStock,
  insertStockMovement,
  setStock,
} from '../repositories/inventory.repository.js';
import { 
  InsufficientStockError, 
  ConcurrencyError, 
  NotFoundError,
  ValidationError 
} from '../utils/errors.js';
import logger from '../config/logger.js';
import Inventory from '../models/inventory.model.js';

class InventoryService {
  
  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * RESERVE STOCK (FOR PENDING ORDERS)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Temporarily holds stock during checkout/payment process
   * Uses optimistic locking to handle concurrent reservations
   * 
   * @param {Array} items - [{ variantId, quantity }]
   * @param {string} orderId - Reference order ID
   * @param {string} performedById - User making the reservation
   * @returns {Promise<Object>} - Reservation result
   */
  async reserveStock(items, orderId, performedById = null, connection = null) {
    const run = async (conn) => {
      const reservations = [];

      for (const item of items) {
        const { variantId, quantity } = item;

        if (quantity <= 0) {
          throw new ValidationError(`Quantity must be positive for variant ${variantId}`);
        }

        const variant = await getVariantForUpdate(conn, variantId);

        if (!variant) {
          throw new NotFoundError(`Product variant ${variantId} not found`);
        }

        const inventory = Inventory.fromData(variant);
        if (!inventory.canDeduct(quantity)) {
          throw new InsufficientStockError(
            `Insufficient stock for ${variant.productName} (SKU: ${variant.sku}). ` +
            `Available: ${variant.stockQuantity}, Requested: ${quantity}`,
            {
              variantId,
              sku: variant.sku,
              available: variant.stockQuantity,
              requested: quantity,
            }
          );
        }

        const updateResult = await decrementStock(conn, variantId, quantity);

        if (!updateResult.affectedRows) {
          throw new ConcurrencyError(
            `Concurrent stock update detected for variant ${variantId}. Please retry.`
          );
        }

        await insertStockMovement(conn, {
          variantId,
          type: 'SALE',
          quantityChange: -quantity,
          previousQuantity: variant.stockQuantity,
          newQuantity: variant.stockQuantity - quantity,
          orderId,
          reason: `Stock reserved for order ${orderId}`,
          performedById,
        });

        reservations.push({
          variantId,
          sku: variant.sku,
          quantity,
        });

        logger.info('Stock reserved', {
          variantId,
          sku: variant.sku,
          quantity,
          orderId,
          remainingStock: variant.stockQuantity - quantity,
        });
      }

      return { success: true, reservations };
    };

    if (connection) {
      return run(connection);
    }

    return withTransactionRetry(run, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * RELEASE STOCK (CANCEL RESERVATION)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Returns reserved stock back to available inventory
   * Used when: payment fails, order cancelled, reservation timeout
   */
  async releaseStock(items, orderId, reason, performedById = null, connection = null) {
    const run = async (conn) => {
      const releases = [];

      for (const item of items) {
        const { variantId, quantity } = item;

        const variant = await getVariantForUpdate(conn, variantId);

        if (!variant) {
          throw new NotFoundError(`Product variant ${variantId} not found`);
        }

        const updateResult = await incrementStock(conn, variantId, quantity);

        if (!updateResult.affectedRows) {
          throw new ConcurrencyError(
            `Concurrent stock update detected for variant ${variantId}. Please retry.`
          );
        }

        await insertStockMovement(conn, {
          variantId,
          type: 'RETURN',
          quantityChange: quantity,
          previousQuantity: variant.stockQuantity,
          newQuantity: variant.stockQuantity + quantity,
          orderId,
          reason: reason || `Stock released for cancelled order ${orderId}`,
          performedById,
        });

        releases.push({
          variantId,
          sku: variant.sku,
          quantity,
        });

        logger.info('Stock released', {
          variantId,
          sku: variant.sku,
          quantity,
          orderId,
          newStock: variant.stockQuantity + quantity,
        });
      }

      return { success: true, releases };
    };

    if (connection) {
      return run(connection);
    }

    return withTransactionRetry(run, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * ADD STOCK (PURCHASE ORDERS, RESTOCKING)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async addStock(variantId, quantity, type = 'PURCHASE_ORDER', reason, purchaseOrderId = null, performedById, connection = null) {
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }
    const run = async (conn) => {
      const variant = await getVariantForUpdate(conn, variantId);

      if (!variant) {
        throw new NotFoundError(`Product variant ${variantId} not found`);
      }

      const updateResult = await incrementStock(conn, variantId, quantity);

      if (!updateResult.affectedRows) {
        throw new ConcurrencyError('Concurrent stock update detected. Please retry.');
      }

      await insertStockMovement(conn, {
        variantId,
        type,
        quantityChange: quantity,
        previousQuantity: variant.stockQuantity,
        newQuantity: variant.stockQuantity + quantity,
        purchaseOrderId,
        reason,
        performedById,
      });

      logger.info('Stock added', {
        variantId,
        sku: variant.sku,
        quantity,
        type,
        newStock: variant.stockQuantity + quantity,
      });

      return {
        variantId,
        sku: variant.sku,
        previousStock: variant.stockQuantity,
        newStock: variant.stockQuantity + quantity,
      };
    };

    if (connection) {
      return run(connection);
    }

    return withTransactionRetry(run, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * MANUAL STOCK ADJUSTMENT
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * For corrections, damages, theft, physical count adjustments
   */
  async adjustStock(variantId, newQuantity, reason, performedById, connection = null) {
    if (newQuantity < 0) {
      throw new ValidationError('Stock quantity cannot be negative');
    }

    if (!reason || reason.trim().length < 10) {
      throw new ValidationError('Detailed reason required for manual adjustments (min 10 characters)');
    }

    const run = async (conn) => {
      const variant = await getVariantForUpdate(conn, variantId);

      if (!variant) {
        throw new NotFoundError(`Product variant ${variantId} not found`);
      }

      const quantityChange = newQuantity - variant.stockQuantity;

      const updateResult = await setStock(conn, variantId, newQuantity);

      if (!updateResult.affectedRows) {
        throw new ConcurrencyError('Concurrent stock update detected. Please retry.');
      }

      await insertStockMovement(conn, {
        variantId,
        type: 'MANUAL_ADJUSTMENT',
        quantityChange,
        previousQuantity: variant.stockQuantity,
        newQuantity,
        reason,
        notes: `Manual adjustment by admin. Previous: ${variant.stockQuantity}, New: ${newQuantity}`,
        performedById,
      });

      logger.warn('Manual stock adjustment', {
        variantId,
        sku: variant.sku,
        previousStock: variant.stockQuantity,
        newStock: newQuantity,
        reason,
        performedBy: performedById,
      });

      return {
        variantId,
        sku: variant.sku,
        previousStock: variant.stockQuantity,
        newStock: newQuantity,
        change: quantityChange,
      };
    };

    if (connection) {
      return run(connection);
    }

    return withTransactionRetry(run, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CHECK STOCK AVAILABILITY (READ-ONLY)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async checkAvailability(items) {
    const availability = [];

    for (const item of items) {
      const variant = await getVariantById(item.variantId);

      if (!variant) {
        availability.push({
          variantId: item.variantId,
          available: false,
          reason: 'Variant not found'
        });
        continue;
      }

      const isAvailable = variant.stockQuantity >= item.quantity;
      const isLowStock = variant.stockQuantity <= variant.lowStockThreshold;

      availability.push({
        variantId: item.variantId,
        sku: variant.sku,
        productName: variant.productName,
        requestedQuantity: item.quantity,
        availableQuantity: variant.stockQuantity,
        available: isAvailable,
        isLowStock,
        stockShortage: isAvailable ? 0 : item.quantity - variant.stockQuantity
      });
    }

    return availability;
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * GET STOCK MOVEMENT HISTORY
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async getStockHistory(variantId, limit = 50) {
    return fetchStockHistory(variantId, limit);
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * GET LOW STOCK ALERTS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async getLowStockAlerts() {
    return fetchLowStockAlerts();
  }
}

export default new InventoryService();
