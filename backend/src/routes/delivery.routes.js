// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELIVERY API ROUTES - CUSTOMER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import deliveryService from '../services/delivery.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/delivery/methods
 * Get available delivery methods for checkout
 * 
 * Query params:
 * - addressId: Address ID to check availability
 * - subtotal: Order subtotal (in cents)
 */
router.get(
  '/methods',
  [
    query('addressId').notEmpty().trim(),
    query('subtotal').isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { addressId, subtotal } = req.query;

      // In production, would fetch address from database
      // For now, this demonstrates the API contract
      // Actual implementation would:
      // 1. Fetch address by ID
      // 2. Validate it belongs to user (if authenticated)
      // 3. Pass address object to service

      const address = {
        country: 'USA',
        state: 'CA',
        city: 'San Francisco'
        // This would come from database lookup of addressId
      };

      const methods = await deliveryService.getAvailableDeliveryMethods(
        address,
        Number(subtotal) / 100 // Convert cents to dollars
      );

      res.json({
        success: true,
        data: methods
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/delivery/track/:orderId
 * Get delivery tracking status for an order
 * Customer can only view their own orders
 */
router.get(
  '/track/:orderId',
  [param('orderId').notEmpty().trim()],
  handleValidationErrors,
  authenticate,
  async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const tracking = await deliveryService.getCustomerDeliveryStatus(orderId);

      // In production, verify that req.user owns this order
      // For now, return the tracking information

      res.json({
        success: true,
        data: tracking
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/delivery/methods/validate
 * Validate a delivery method selection before checkout
 */
router.post(
  '/methods/validate',
  [
    body('deliveryMethodId').notEmpty().trim(),
    body('addressId').notEmpty().trim(),
    body('subtotal').isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { deliveryMethodId, addressId, subtotal } = req.body;

      // Validate the delivery method exists and is active
      const method = await deliveryService.validateDeliveryMethod(deliveryMethodId);

      // Validate it's available for the given address/subtotal
      // (In production, would fetch and validate address)
      const address = {
        country: 'USA',
        state: 'CA',
        city: 'San Francisco'
      };

      const available = await deliveryService.getAvailableDeliveryMethods(
        address,
        Number(subtotal) / 100
      );

      const isAvailable = available.some(m => m.id === deliveryMethodId);

      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          error: 'Selected delivery method is not available for your location or order'
        });
      }

      res.json({
        success: true,
        data: {
          methodId: method.id,
          name: method.name,
          price: Number(method.basePrice),
          valid: true
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
