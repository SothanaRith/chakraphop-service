import { Router } from 'express';
import { body, param } from 'express-validator';
import wishlistController from '../controllers/wishlist.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';

const router = Router();

router.use(authenticate);

const addItemValidation = [
  body('productId').notEmpty().withMessage('productId is required'),
  body('notes').optional().isString().withMessage('notes must be a string'),
  body('priority').optional().isInt({ min: 0 }).withMessage('priority must be >= 0'),
];

const productIdParamValidation = [
  param('productId').notEmpty().withMessage('productId is required'),
];

router.get('/', wishlistController.getWishlist);
router.post('/', addItemValidation, validate, wishlistController.addItem);
router.delete('/:productId', productIdParamValidation, validate, wishlistController.removeItem);
router.delete('/', wishlistController.clear);
router.post('/:productId/move-to-cart', productIdParamValidation, validate, wishlistController.moveItemToCart);
router.get('/:productId/status', productIdParamValidation, validate, wishlistController.checkItem);

export default router;
