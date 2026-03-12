// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN DELIVERY MANAGEMENT ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import deliveryService from '../services/delivery.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/errorHandler.js';

const router = express.Router();

// All admin delivery routes require SUPER_ADMIN or ADMIN role
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

/**
 * GET /api/admin/delivery/methods
 * List all delivery methods with availability rules
 */
router.get(
  '/methods',
  [
    query('active').optional().isBoolean(),
    query('type').optional().isIn(['STANDARD', 'EXPRESS', 'PICKUP'])
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { active, type } = req.query;

      const methods = await deliveryService.getAllDeliveryMethods({
        active: active ? active === 'true' : null,
        type: type || null
      });

      res.json({
        success: true,
        data: methods,
        count: methods.length
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/delivery/methods
 * Create a new delivery method
 */
router.post(
  '/methods',
  [
    body('name').notEmpty().trim().isLength({ min: 3, max: 100 }),
    body('type').isIn(['STANDARD', 'EXPRESS', 'PICKUP']),
    body('basePrice').isDecimal({ force_decimal: true, decimal_digits: '1,2' }),
    body('estimatedDaysMin').isInt({ min: 0, max: 30 }),
    body('estimatedDays').isInt({ min: 0, max: 30 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('minOrderAmount').optional().isDecimal({ force_decimal: true, decimal_digits: '1,2' })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { name, type, basePrice, estimatedDaysMin, estimatedDays, description, minOrderAmount } = req.body;

      const method = await deliveryService.createDeliveryMethod({
        name,
        type,
        basePrice: parseFloat(basePrice),
        estimatedDaysMin: parseInt(estimatedDaysMin, 10),
        estimatedDays: parseInt(estimatedDays, 10),
        description,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0
      });

      res.status(201).json({
        success: true,
        data: method
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/admin/delivery/methods/:methodId
 * Update delivery method
 */
router.patch(
  '/methods/:methodId',
  [
    param('methodId').notEmpty().trim(),
    body('name').optional().trim().isLength({ min: 3, max: 100 }),
    body('basePrice').optional().isDecimal({ force_decimal: true, decimal_digits: '1,2' }),
    body('estimatedDaysMin').optional().isInt({ min: 0, max: 30 }),
    body('estimatedDays').optional().isInt({ min: 0, max: 30 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('isActive').optional().isBoolean(),
    body('minOrderAmount').optional().isDecimal({ force_decimal: true, decimal_digits: '1,2' })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { methodId } = req.params;
      const updateData = req.body;

      // Convert numeric strings
      if (updateData.basePrice) updateData.basePrice = parseFloat(updateData.basePrice);
      if (updateData.minOrderAmount) updateData.minOrderAmount = parseFloat(updateData.minOrderAmount);
      if (updateData.estimatedDaysMin) updateData.estimatedDaysMin = parseInt(updateData.estimatedDaysMin, 10);
      if (updateData.estimatedDays) updateData.estimatedDays = parseInt(updateData.estimatedDays, 10);

      const updated = await deliveryService.updateDeliveryMethod(methodId, updateData);

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/delivery/availability
 * Set availability rule for a delivery method by location
 */
router.post(
  '/availability',
  [
    body('deliveryMethodId').notEmpty().trim(),
    body('country').notEmpty().trim().isLength({ min: 2, max: 2 }), // ISO country code
    body('state').optional().trim().isLength({ min: 2, max: 2 }), // ISO state code
    body('city').optional().trim().isLength({ max: 100 }),
    body('isAvailable').isBoolean()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { deliveryMethodId, country, state, city, isAvailable } = req.body;

      const rule = await deliveryService.setAvailabilityRule(
        deliveryMethodId,
        country,
        state || null,
        city || null,
        isAvailable
      );

      res.json({
        success: true,
        data: rule
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/admin/delivery/orders/:orderId/status
 * Update delivery status for an order
 */
router.patch(
  '/orders/:orderId/status',
  [
    param('orderId').notEmpty().trim(),
    body('status').isIn(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED']),
    body('trackingNumber').optional().trim().isLength({ min: 1, max: 100 }),
    body('carrier').optional().trim().isLength({ min: 1, max: 50 }),
    body('carrierUrl').optional().isURL(),
    body('reason').optional().trim().isLength({ max: 500 }),
    body('notes').optional().trim().isLength({ max: 1000 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { status, trackingNumber, carrier, carrierUrl, reason, notes } = req.body;

      const updated = await deliveryService.updateDeliveryStatus(orderId, status, {
        trackingNumber,
        carrier,
        carrierUrl,
        reason,
        notes,
        adminId: req.user.id // Admin user ID from auth middleware
      });

      res.json({
        success: true,
        data: updated,
        message: `Delivery status updated to ${status}`
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/delivery/orders/:orderId/tracking
 * Get full delivery tracking history for an order
 */
router.get(
  '/orders/:orderId/tracking',
  [param('orderId').notEmpty().trim()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const tracking = await deliveryService.getCustomerDeliveryStatus(orderId);

      res.json({
        success: true,
        data: tracking
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
