import { Router } from 'express';
import { body } from 'express-validator';
import accessorySetController from '../controllers/accessory-set.controller.js';
import { optionalAuthenticate, authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validation.middleware.js';

const router = Router();

const setValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('slug')
    .trim()
    .notEmpty()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('slug must use lowercase letters and hyphens'),
  body('bundlePrice').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('bundlePrice must be >= 0'),
  body('status').optional().isIn(['DRAFT', 'ACTIVE', 'ARCHIVED']).withMessage('invalid status'),
];

const setUpdateValidation = [
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('slug must use lowercase letters and hyphens'),
  body('bundlePrice').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('bundlePrice must be >= 0'),
  body('status').optional().isIn(['DRAFT', 'ACTIVE', 'ARCHIVED']).withMessage('invalid status'),
];

const setItemValidation = [
  body('productId').notEmpty().withMessage('productId is required'),
  body('variantId').optional().isString().withMessage('variantId must be a string'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be >= 1'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be >= 0'),
];

const setItemUpdateValidation = [
  body('productId').optional().isString().withMessage('productId must be a string'),
  body('variantId').optional().isString().withMessage('variantId must be a string'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be >= 1'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be >= 0'),
  body('note').optional().isString().withMessage('note must be a string'),
];

router.get('/', optionalAuthenticate, accessorySetController.getSets);
router.get('/:slug', optionalAuthenticate, accessorySetController.getSetBySlug);

router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER']),
  setValidation,
  validate,
  accessorySetController.createSet
);

router.patch(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER']),
  setUpdateValidation,
  validate,
  accessorySetController.updateSet
);

router.post(
  '/:id/items',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER']),
  setItemValidation,
  validate,
  accessorySetController.addItem
);

router.patch(
  '/:id/items/:itemId',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER']),
  setItemUpdateValidation,
  validate,
  accessorySetController.updateItem
);

router.delete(
  '/:id/items/:itemId',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER']),
  accessorySetController.removeItem
);

export default router;
