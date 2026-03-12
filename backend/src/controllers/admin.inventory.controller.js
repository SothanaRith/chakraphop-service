// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: INVENTORY MANAGEMENT CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Critical stock control endpoints with transaction safety
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import adminInventoryService from '../services/admin.inventory.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AdminInventoryController {
  /**
   * Get stock overview with low-stock alerts
   * GET /api/admin/inventory/overview
   * Query: page, limit, lowStockOnly
   */
  getInventoryOverview = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, lowStockOnly = false } = req.query;

    const result = await adminInventoryService.getInventoryOverview({
      page: parseInt(page),
      limit: parseInt(limit),
      lowStockOnly: lowStockOnly === 'true'
    });

    res.json(success(result, 'Inventory overview retrieved successfully'));
  });

  /**
   * Get detailed stock by product
   * GET /api/admin/inventory/product/:productId
   */
  getProductStock = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const stock = await adminInventoryService.getProductStock(productId);

    res.json(success(stock, 'Product stock retrieved successfully'));
  });

  /**
   * Get stock by variant
   * GET /api/admin/inventory/variant/:variantId
   */
  getVariantStock = asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    const stock = await adminInventoryService.getVariantStock(variantId);

    res.json(success(stock, 'Variant stock retrieved successfully'));
  });

  /**
   * CRITICAL: Stock in (receive from supplier)
   * POST /api/admin/inventory/stock-in
   * Body: variantId, quantity, purchaseOrderNumber, supplierName, notes
   */
  stockIn = asyncHandler(async (req, res) => {
    const { variantId, quantity, purchaseOrderNumber, supplierName, notes } = req.body;

    const result = await adminInventoryService.stockIn(
      {
        variantId,
        quantity,
        purchaseOrderNumber,
        supplierName,
        notes
      },
      req.user.id
    );

    res.status(201).json(success(result, 'Stock received successfully'));
  });

  /**
   * CRITICAL: Manual stock adjustment (damage, theft, recount)
   * POST /api/admin/inventory/adjust-stock
   * Body: variantId, adjustment, reason, notes, requiresApproval
   */
  adjustStock = asyncHandler(async (req, res) => {
    const { variantId, adjustment, reason, notes, requiresApproval } = req.body;

    const result = await adminInventoryService.adjustStock(
      {
        variantId,
        adjustment,
        reason,
        notes,
        requiresApproval: requiresApproval || false
      },
      req.user.id
    );

    res.status(201).json(success(result, 'Stock adjusted successfully'));
  });

  /**
   * Set low-stock threshold for variant
   * POST /api/admin/inventory/variant/:variantId/threshold
   * Body: threshold, reorderQuantity
   */
  setLowStockThreshold = asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const { threshold, reorderQuantity } = req.body;

    const result = await adminInventoryService.setLowStockThreshold(
      variantId,
      { threshold, reorderQuantity },
      req.user.id
    );

    res.json(success(result, 'Low-stock threshold updated successfully'));
  });

  /**
   * Get inventory movement history
   * GET /api/admin/inventory/movements
   * Query: variantId, productId, type, page, limit, startDate, endDate
   */
  getInventoryMovements = asyncHandler(async (req, res) => {
    const { 
      variantId, 
      productId, 
      type, 
      page = 1, 
      limit = 50,
      startDate,
      endDate 
    } = req.query;

    const result = await adminInventoryService.getInventoryMovements({
      variantId,
      productId,
      type,
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate
    });

    res.json(success(result, 'Inventory movements retrieved successfully'));
  });

  /**
   * Get inventory variance report
   * GET /api/admin/inventory/variance
   * Query: page, limit
   */
  getVarianceReport = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;

    const result = await adminInventoryService.getVarianceReport({
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(success(result, 'Inventory variance report retrieved successfully'));
  });

  /**
   * Get low-stock alert items
   * GET /api/admin/inventory/low-stock-alerts
   * Query: page, limit, severity
   */
  getLowStockAlerts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, severity } = req.query;

    const result = await adminInventoryService.getLowStockAlerts({
      page: parseInt(page),
      limit: parseInt(limit),
      severity
    });

    res.json(success(result, 'Low-stock alerts retrieved successfully'));
  });

  /**
   * Approve stock adjustment (if required approval)
   * POST /api/admin/inventory/adjust-stock/:adjustmentId/approve
   * Body: notes
   */
  approveStockAdjustment = asyncHandler(async (req, res) => {
    const { adjustmentId } = req.params;
    const { notes } = req.body;

    const result = await adminInventoryService.approveStockAdjustment(
      adjustmentId,
      notes,
      req.user.id
    );

    res.json(success(result, 'Stock adjustment approved successfully'));
  });

  /**
   * Reject stock adjustment
   * POST /api/admin/inventory/adjust-stock/:adjustmentId/reject
   * Body: reason
   */
  rejectStockAdjustment = asyncHandler(async (req, res) => {
    const { adjustmentId } = req.params;
    const { reason } = req.body;

    const result = await adminInventoryService.rejectStockAdjustment(
      adjustmentId,
      reason,
      req.user.id
    );

    res.json(success(result, 'Stock adjustment rejected successfully'));
  });

  /**
   * Bulk stock import (CSV processing)
   * POST /api/admin/inventory/bulk-import
   * Body: CSV file or array of stock updates
   */
  bulkStockImport = asyncHandler(async (req, res) => {
    const { updates } = req.body;

    const result = await adminInventoryService.bulkStockImport(
      updates,
      req.user.id
    );

    res.json(success(result, 'Bulk stock import processed successfully'));
  });
}

export default new AdminInventoryController();
