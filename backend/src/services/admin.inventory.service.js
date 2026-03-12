// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: INVENTORY MANAGEMENT SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Transaction-safe stock management with audit trail
// CRITICAL: Prevents negative stock and ensures data integrity
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { randomUUID } from 'crypto';
import { withTransactionRetry } from '../db/index.js';
import { NotFoundError, ValidationError, InsufficientStockError } from '../utils/errors.js';
import logger from '../config/logger.js';
import inventoryService from './inventory.service.js';
import {
  countStockMovements,
  countVariants,
  countVarianceReport,
  createStockAdjustment,
  getProductWithVariants,
  getStockAdjustmentById,
  getVariantWithProduct,
  insertAdminActionLog,
  listStockMovements,
  listVariantsWithProduct,
  listVarianceReport,
  updateStockAdjustment,
  updateVariantThreshold,
} from '../repositories/admin.inventory.repository.js';

class AdminInventoryService {
  /**
   * Get inventory overview with low-stock alerts
   */
  async getInventoryOverview({ page = 1, limit = 50, lowStockOnly = false }) {
    const offset = (page - 1) * limit;

    const [variants, totalResult] = await Promise.all([
      listVariantsWithProduct({ offset, limit, lowStockOnly }),
      countVariants({ lowStockOnly })
    ]);

    const overview = variants.map(v => {
      let attributes = null;
      try {
        attributes = v.attributes ? JSON.parse(v.attributes) : null;
      } catch (error) {
        attributes = null;
      }

      return {
        variantId: v.id,
        productId: v.productId,
        productName: v.productName,
        sku: v.sku,
        attributes,
        stockQuantity: v.stockQuantity,
        lowStockThreshold: v.lowStockThreshold,
        price: v.price,
        status: v.stockQuantity <= v.lowStockThreshold ? 'LOW' : 'OK'
      };
    });

    const total = totalResult?.total || 0;

    return {
      items: overview,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get detailed stock for product
   */
  async getProductStock(productId) {
    const product = await getProductWithVariants(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0);

    return {
      productId: product.id,
      productName: product.name,
      totalStock,
      variants: product.variants
    };
  }

  /**
   * Get stock for variant
   */
  async getVariantStock(variantId) {
    const variant = await getVariantWithProduct(variantId);

    if (!variant) {
      throw new NotFoundError('Product variant not found');
    }

    let attributes = null;
    try {
      attributes = variant.attributes ? JSON.parse(variant.attributes) : null;
    } catch (error) {
      attributes = null;
    }

    return {
      variantId: variant.id,
      productName: variant.productName,
      sku: variant.sku,
      attributes,
      stockQuantity: variant.stockQuantity,
      lowStockThreshold: variant.lowStockThreshold,
      price: variant.price,
      status: variant.stockQuantity <= variant.lowStockThreshold ? 'LOW' : 'OK'
    };
  }

  /**
   * CRITICAL: Stock in (receive inventory from supplier)
   * Uses transaction to ensure atomicity
   */
  async stockIn({ variantId, quantity, purchaseOrderNumber, supplierName, notes }, adminUserId) {
    if (quantity <= 0) {
      throw new ValidationError('Stock quantity must be greater than 0');
    }
    return withTransactionRetry(async (connection) => {
      const reason = `Stock in from ${supplierName}. PO: ${purchaseOrderNumber}. ${notes || ''}`;
      const result = await inventoryService.addStock(
        variantId,
        quantity,
        'PURCHASE_ORDER',
        reason,
        null,
        adminUserId,
        connection
      );

      const variant = await getVariantWithProduct(variantId);

      logger.info('Stock received', {
        variantId,
        quantity,
        purchaseOrderNumber,
        supplier: supplierName,
        receivedBy: adminUserId
      });

      return {
        variantId,
        productName: variant?.productName,
        previousQuantity: result.previousStock,
        newQuantity: result.newStock,
        quantityAdded: quantity,
        purchaseOrderNumber,
        supplier: supplierName
      };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * CRITICAL: Manual stock adjustment (damage, theft, count correction)
   * Requires reason and optionally approval
   */
  async adjustStock({ variantId, adjustment, reason, notes, requiresApproval }, adminUserId) {
    if (adjustment === 0) {
      throw new ValidationError('Adjustment must be non-zero');
    }

    const validReasons = ['DAMAGE', 'THEFT', 'COUNT_CORRECTION', 'RETURN', 'WASTE'];
    if (!validReasons.includes(reason)) {
      throw new ValidationError(`Invalid reason. Allowed: ${validReasons.join(', ')}`);
    }

    return withTransactionRetry(async (connection) => {
      const variant = await getVariantWithProduct(variantId);

      if (!variant) {
        throw new NotFoundError('Product variant not found');
      }

      const newQuantity = variant.stockQuantity + adjustment;

      if (newQuantity < 0) {
        throw new InsufficientStockError(
          `Cannot adjust stock below 0. Current: ${variant.stockQuantity}, Adjustment: ${adjustment}`
        );
      }

      if (requiresApproval) {
        const adjustmentId = randomUUID();
        await createStockAdjustment(connection, {
          id: adjustmentId,
          variantId,
          adjustment,
          reason,
          notes,
          status: 'PENDING',
          requestedBy: adminUserId,
        });

        logger.info('Stock adjustment requested (pending approval)', {
          variantId,
          adjustment,
          reason,
        });

        return {
          status: 'PENDING',
          adjustmentId,
          message: 'Stock adjustment pending approval'
        };
      }

      const adjustmentNotes = notes || `Manual adjustment: ${reason}`;
      await inventoryService.adjustStock(
        variantId,
        newQuantity,
        adjustmentNotes.length >= 10 ? adjustmentNotes : `${adjustmentNotes} (admin)`,
        adminUserId,
        connection
      );

      logger.warn('Stock adjusted manually', {
        variantId,
        adjustment,
        reason,
        approvedBy: adminUserId
      });

      return {
        status: 'APPLIED',
        variantId,
        productName: variant.productName,
        previousQuantity: variant.stockQuantity,
        newQuantity,
        adjustment,
        reason
      };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * Set low-stock threshold for variant
   */
  async setLowStockThreshold(variantId, { threshold, reorderQuantity }, adminUserId) {
    if (threshold < 0) {
      throw new ValidationError('Threshold must be non-negative');
    }

    const variant = await getVariantWithProduct(variantId);

    if (!variant) {
      throw new NotFoundError('Product variant not found');
    }

    await updateVariantThreshold(variantId, threshold);

    await this._logInventoryAction(adminUserId, 'SET_THRESHOLD', {
      variantId,
      threshold
    });

    return {
      variantId,
      lowStockThreshold: threshold
    };
  }

  /**
   * Get inventory movement history
   */
  async getInventoryMovements({ variantId, productId, type, page = 1, limit = 50, startDate, endDate }) {
    const offset = (page - 1) * limit;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const [movements, totalResult] = await Promise.all([
      listStockMovements({ variantId, type, startDate: start, endDate: end, limit, offset }),
      countStockMovements({ variantId, type, startDate: start, endDate: end })
    ]);

    const total = totalResult?.total || 0;

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get variance report (potential discrepancies)
   */
  async getVarianceReport({ page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const [variances, totalResult] = await Promise.all([
      listVarianceReport({ limit, offset }),
      countVarianceReport()
    ]);

    const total = totalResult?.total || 0;

    return {
      variances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get low-stock alerts
   */
  async getLowStockAlerts({ page = 1, limit = 50, severity }) {
    const offset = (page - 1) * limit;
    const [alerts, totalResult] = await Promise.all([
      listVariantsWithProduct({ offset, limit, lowStockOnly: true }),
      countVariants({ lowStockOnly: true })
    ]);

    const total = totalResult?.total || 0;

    return {
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Approve stock adjustment request
   */
  async approveStockAdjustment(adjustmentId, approvalNotes, adminUserId) {
    return withTransactionRetry(async (connection) => {
      const adjustment = await getStockAdjustmentById(connection, adjustmentId);

      if (!adjustment) {
        throw new NotFoundError('Stock adjustment not found');
      }

      if (adjustment.status !== 'PENDING') {
        throw new ValidationError('Adjustment is not pending');
      }

      const variant = await getVariantWithProduct(adjustment.variantId);
      const newQuantity = variant.stockQuantity + adjustment.adjustment;

      if (newQuantity < 0) {
        throw new InsufficientStockError('Cannot approve: would result in negative stock');
      }

      const approvalReason = `Approved adjustment: ${adjustment.reason}. ${approvalNotes || ''}`;
      await inventoryService.adjustStock(
        adjustment.variantId,
        newQuantity,
        approvalReason.length >= 10 ? approvalReason : `${approvalReason} (admin)`,
        adminUserId,
        connection
      );

      await updateStockAdjustment(connection, adjustmentId, {
        status: 'APPROVED',
        approvedBy: adminUserId,
        approvalNotes
      });

      logger.info('Stock adjustment approved', {
        adjustmentId,
        variantId: adjustment.variantId,
        adjustment: adjustment.adjustment,
        approvedBy: adminUserId
      });

      return {
        status: 'APPROVED',
        adjustmentId,
        variantId: adjustment.variantId
      };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  /**
   * Reject stock adjustment request
   */
  async rejectStockAdjustment(adjustmentId, reason, adminUserId) {
    const adjustment = await getStockAdjustmentById(null, adjustmentId);

    if (!adjustment) {
      throw new NotFoundError('Stock adjustment not found');
    }

    if (adjustment.status !== 'PENDING') {
      throw new ValidationError('Adjustment is not pending');
    }

    await updateStockAdjustment(null, adjustmentId, {
      status: 'REJECTED',
      approvedBy: adminUserId,
      approvalNotes: reason
    });

    logger.info('Stock adjustment rejected', {
      adjustmentId,
      reason,
      rejectedBy: adminUserId
    });

    return {
      status: 'REJECTED',
      adjustmentId,
      reason
    };
  }

  /**
   * Bulk stock import from CSV
   */
  async bulkStockImport(updates, adminUserId) {
    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const result = await this.stockIn(
          {
            variantId: update.variantId,
            quantity: update.quantity,
            purchaseOrderNumber: update.poNumber || 'BULK_IMPORT',
            supplierName: update.supplier || 'Manual Import',
            notes: update.notes
          },
          adminUserId
        );
        results.push({ ...result, status: 'SUCCESS' });
      } catch (error) {
        errors.push({
          variantId: update.variantId,
          error: error.message
        });
      }
    }

    logger.info('Bulk stock import completed', {
      successful: results.length,
      failed: errors.length,
      importedBy: adminUserId
    });

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  /**
   * Log inventory action for audit
   */
  async _logInventoryAction(adminId, action, metadata) {
    try {
      await insertAdminActionLog(
        adminId,
        `INVENTORY_${action}`,
        JSON.stringify(metadata)
      );
    } catch (error) {
      logger.error('Failed to log inventory action', { error });
    }
  }
}

export default new AdminInventoryService();
