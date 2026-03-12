// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVENTORY CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import inventoryService from '../services/inventory.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class InventoryController {
  /**
   * Check stock availability
   * GET /api/inventory/:variantId/availability
   */
  checkAvailability = asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const { quantity } = req.query;

    const availability = await inventoryService.checkAvailability(
      variantId,
      parseInt(quantity) || 1
    );

    res.json(success(availability));
  });

  /**
   * Get stock movements for variant
   * GET /api/inventory/:variantId/movements
   */
  getStockMovements = asyncHandler(async (req, res) => {
    const { variantId } = req.params;
    const { page, limit } = req.query;

    const result = await inventoryService.getStockMovements(variantId, { page, limit });

    res.json(success(result));
  });

  /**
   * Add stock (purchase order receive)
   * POST /api/inventory/add-stock
   */
  addStock = asyncHandler(async (req, res) => {
    const { variantId, quantity, purchaseOrderId, notes } = req.body;

    const result = await inventoryService.addStock(
      variantId,
      quantity,
      req.user.id,
      purchaseOrderId,
      notes
    );

    res.json(success(result, 'Stock added successfully'));
  });

  /**
   * Adjust stock (manual correction)
   * POST /api/inventory/adjust-stock
   */
  adjustStock = asyncHandler(async (req, res) => {
    const { variantId, quantity, reason } = req.body;

    const result = await inventoryService.adjustStock(
      variantId,
      quantity,
      req.user.id,
      reason
    );

    res.json(success(result, 'Stock adjusted successfully'));
  });

  /**
   * Get low stock report
   * GET /api/inventory/low-stock
   */
  getLowStockReport = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;

    const result = await inventoryService.getLowStockReport({ page, limit });

    res.json(success(result));
  });

  /**
   * Get inventory summary
   * GET /api/inventory/summary
   */
  getInventorySummary = asyncHandler(async (req, res) => {
    const summary = await inventoryService.getInventorySummary();
    res.json(success(summary));
  });

  /**
   * Reserve stock (internal - used during checkout)
   * POST /api/inventory/reserve
   */
  reserveStock = asyncHandler(async (req, res) => {
    const { variantId, quantity, orderId, userId } = req.body;

    const result = await inventoryService.reserveStock(
      variantId,
      quantity,
      orderId,
      userId
    );

    res.json(success(result, 'Stock reserved'));
  });

  /**
   * Release stock (internal - used on payment failure/cancellation)
   * POST /api/inventory/release
   */
  releaseStock = asyncHandler(async (req, res) => {
    const { variantId, quantity, orderId, reason } = req.body;

    const result = await inventoryService.releaseStock(
      variantId,
      quantity,
      orderId,
      reason
    );

    res.json(success(result, 'Stock released'));
  });
}

export default new InventoryController();
