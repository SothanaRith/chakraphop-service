// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN API ROUTES (COMPREHENSIVE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Complete admin API with role-based access control
// CRITICAL: All routes require admin authentication
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { 
  authorize, 
  authorizeMinRole, 
  superAdminOnly, 
  adminOnly,
  inventoryAccess 
} from '../middleware/rbac.middleware.js';

// Controllers
import adminUsersController from '../controllers/admin.users.controller.js';
import adminInventoryController from '../controllers/admin.inventory.controller.js';
import adminProductsController from '../controllers/admin.products.controller.js';
import adminOrdersController from '../controllers/admin.orders.controller.js';
import adminDashboardController from '../controllers/admin.dashboard.controller.js';
import adminLearningController from '../controllers/admin.learning.controller.js';
import adminMediaController from '../controllers/admin.media.controller.js';

const router = Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION REQUIREMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// All admin endpoints require authentication
router.use(authenticate);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 0. DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get(
  '/dashboard/summary',
  authorize(['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER', 'INSTRUCTOR']),
  adminDashboardController.getSummary
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. USER & ROLE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users (paginated, filterable)
 * @access  Admin, Super Admin
 * @query   role, status, page, limit, search
 */
router.get(
  '/users',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminUsersController.getAllUsers
);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get specific user details
 * @access  Admin, Super Admin
 */
router.get(
  '/users/:userId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminUsersController.getUserById
);

/**
 * @route   POST /api/admin/users
 * @desc    Create new admin user
 * @access  Super Admin only
 * @body    email, password, firstName, lastName, role
 */
router.post(
  '/users',
  superAdminOnly,
  adminUsersController.createUser
);

/**
 * @route   PATCH /api/admin/users/:userId
 * @desc    Update user information
 * @access  Super Admin only
 * @body    firstName, lastName, email, role
 */
router.patch(
  '/users/:userId',
  superAdminOnly,
  adminUsersController.updateUser
);

/**
 * @route   PATCH /api/admin/users/:userId/role
 * @desc    Change user role (sensitive operation)
 * @access  Super Admin only
 * @body    role
 */
router.patch(
  '/users/:userId/role',
  superAdminOnly,
  adminUsersController.updateUserRole
);

/**
 * @route   POST /api/admin/users/:userId/disable
 * @desc    Disable user account
 * @access  Super Admin only
 * @body    reason (optional)
 */
router.post(
  '/users/:userId/disable',
  superAdminOnly,
  adminUsersController.disableUser
);

/**
 * @route   POST /api/admin/users/:userId/enable
 * @desc    Re-enable user account
 * @access  Super Admin only
 */
router.post(
  '/users/:userId/enable',
  superAdminOnly,
  adminUsersController.enableUser
);

/**
 * @route   POST /api/admin/users/:userId/reset-password
 * @desc    Reset user password (sensitive)
 * @access  Super Admin only
 * @body    newPassword
 */
router.post(
  '/users/:userId/reset-password',
  superAdminOnly,
  adminUsersController.resetUserPassword
);

/**
 * @route   GET /api/admin/activity
 * @desc    Get admin activity log (audit trail)
 * @access  Admin, Super Admin
 * @query   userId, action, page, limit, startDate, endDate
 */
router.get(
  '/activity',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminUsersController.getActivityLog
);

/**
 * @route   GET /api/admin/roles/permissions
 * @desc    Get role and permission matrix
 * @access  Admin, Super Admin
 */
router.get(
  '/roles/permissions',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminUsersController.getRolePermissions
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. INVENTORY MANAGEMENT (CRITICAL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/admin/inventory/overview
 * @desc    Get inventory overview with low-stock alerts
 * @access  Inventory Manager, Admin, Super Admin
 * @query   page, limit, lowStockOnly
 */
router.get(
  '/inventory/overview',
  inventoryAccess,
  adminInventoryController.getInventoryOverview
);

/**
 * @route   GET /api/admin/inventory/product/:productId
 * @desc    Get detailed stock by product
 * @access  Inventory Manager, Admin, Super Admin
 */
router.get(
  '/inventory/product/:productId',
  inventoryAccess,
  adminInventoryController.getProductStock
);

/**
 * @route   GET /api/admin/inventory/variant/:variantId
 * @desc    Get stock for specific variant
 * @access  Inventory Manager, Admin, Super Admin
 */
router.get(
  '/inventory/variant/:variantId',
  inventoryAccess,
  adminInventoryController.getVariantStock
);

/**
 * @route   POST /api/admin/inventory/stock-in
 * @desc    CRITICAL: Receive inventory from supplier
 * @access  Inventory Manager, Admin, Super Admin
 * @body    variantId, quantity, purchaseOrderNumber, supplierName, notes
 */
router.post(
  '/inventory/stock-in',
  inventoryAccess,
  adminInventoryController.stockIn
);

/**
 * @route   POST /api/admin/inventory/adjust-stock
 * @desc    CRITICAL: Manual stock adjustment (damage, theft, recount)
 * @access  Inventory Manager, Admin, Super Admin
 * @body    variantId, adjustment, reason, notes, requiresApproval
 */
router.post(
  '/inventory/adjust-stock',
  inventoryAccess,
  adminInventoryController.adjustStock
);

/**
 * @route   POST /api/admin/inventory/variant/:variantId/threshold
 * @desc    Set low-stock threshold for variant
 * @access  Inventory Manager, Admin, Super Admin
 * @body    threshold, reorderQuantity
 */
router.post(
  '/inventory/variant/:variantId/threshold',
  inventoryAccess,
  adminInventoryController.setLowStockThreshold
);

/**
 * @route   GET /api/admin/inventory/movements
 * @desc    Get inventory movement history
 * @access  Inventory Manager, Admin, Super Admin
 * @query   variantId, productId, type, page, limit, startDate, endDate
 */
router.get(
  '/inventory/movements',
  inventoryAccess,
  adminInventoryController.getInventoryMovements
);

/**
 * @route   GET /api/admin/inventory/variance
 * @desc    Get inventory variance report
 * @access  Inventory Manager, Admin, Super Admin
 * @query   page, limit
 */
router.get(
  '/inventory/variance',
  inventoryAccess,
  adminInventoryController.getVarianceReport
);

/**
 * @route   GET /api/admin/inventory/low-stock-alerts
 * @desc    Get low-stock alert items
 * @access  Inventory Manager, Admin, Super Admin
 * @query   page, limit, severity
 */
router.get(
  '/inventory/low-stock-alerts',
  inventoryAccess,
  adminInventoryController.getLowStockAlerts
);

/**
 * @route   POST /api/admin/inventory/adjust-stock/:adjustmentId/approve
 * @desc    Approve pending stock adjustment
 * @access  Admin, Super Admin
 * @body    notes
 */
router.post(
  '/inventory/adjust-stock/:adjustmentId/approve',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminInventoryController.approveStockAdjustment
);

/**
 * @route   POST /api/admin/inventory/adjust-stock/:adjustmentId/reject
 * @desc    Reject pending stock adjustment
 * @access  Admin, Super Admin
 * @body    reason
 */
router.post(
  '/inventory/adjust-stock/:adjustmentId/reject',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminInventoryController.rejectStockAdjustment
);

/**
 * @route   POST /api/admin/inventory/bulk-import
 * @desc    Bulk stock import
 * @access  Admin, Super Admin
 * @body    updates (array of stock updates)
 */
router.post(
  '/inventory/bulk-import',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminInventoryController.bulkStockImport
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. PRODUCT MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/admin/products
 * @desc    Get all products with pagination
 * @access  Admin, Super Admin
 * @query   status, category, sportId, page, limit, search, sortBy
 */
router.get(
  '/products',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.getAllProducts
);

/**
 * @route   GET /api/admin/products/:productId
 * @desc    Get product details
 * @access  Admin, Super Admin
 */
router.get(
  '/products/:productId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.getProductById
);

/**
 * @route   POST /api/admin/products
 * @desc    Create new product
 * @access  Admin, Super Admin
 * @body    name, description, sku, categoryId, sportId, status, images
 */
router.post(
  '/products',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.createProduct
);

/**
 * @route   PATCH /api/admin/products/:productId
 * @desc    Update product
 * @access  Admin, Super Admin
 * @body    name, description, categoryId, sportId, status, images
 */
router.patch(
  '/products/:productId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.updateProduct
);

/**
 * @route   POST /api/admin/products/:productId/publish
 * @desc    Publish product (make visible)
 * @access  Admin, Super Admin
 */
router.post(
  '/products/:productId/publish',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.publishProduct
);

/**
 * @route   POST /api/admin/products/:productId/archive
 * @desc    Archive product (soft delete)
 * @access  Admin, Super Admin
 */
router.post(
  '/products/:productId/archive',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.archiveProduct
);

/**
 * @route   POST /api/admin/products/:productId/variants
 * @desc    Create product variant
 * @access  Admin, Super Admin
 * @body    sku, size, color, price, cost, images
 */
router.post(
  '/products/:productId/variants',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.createVariant
);

/**
 * @route   PATCH /api/admin/products/:productId/variants/:variantId
 * @desc    Update product variant
 * @access  Admin, Super Admin
 * @body    sku, size, color, price, cost, images
 */
router.patch(
  '/products/:productId/variants/:variantId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.updateVariant
);

/**
 * @route   GET /api/admin/products/:productId/variants
 * @desc    Get all variants for product
 * @access  Admin, Super Admin
 */
router.get(
  '/products/:productId/variants',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.getProductVariants
);

/**
 * @route   POST /api/admin/products/bulk-update/prices
 * @desc    Bulk update product prices
 * @access  Admin, Super Admin
 * @body    updates (array of {variantId, price})
 */
router.post(
  '/products/bulk-update/prices',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.bulkUpdatePrices
);

/**
 * @route   POST /api/admin/products/bulk-update/status
 * @desc    Bulk update product status
 * @access  Admin, Super Admin
 * @body    productIds, status
 */
router.post(
  '/products/bulk-update/status',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.bulkUpdateStatus
);

/**
 * @route   GET /api/admin/products/:productId/images
 * @desc    Get product images
 * @access  Admin, Super Admin
 */
router.get(
  '/products/:productId/images',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.getProductImages
);

/**
 * @route   POST /api/admin/products/:productId/images
 * @desc    Upload product image
 * @access  Admin, Super Admin
 * @body    imageFile, alt, isPrimary
 */
router.post(
  '/products/:productId/images',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.uploadProductImage
);

/**
 * @route   DELETE /api/admin/products/:productId/images/:imageId
 * @desc    Delete product image
 * @access  Admin, Super Admin
 */
router.delete(
  '/products/:productId/images/:imageId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminProductsController.deleteProductImage
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. ORDER MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders with filtering
 * @access  Admin, Super Admin
 * @query   status, userId, page, limit, dateFrom, dateTo, search
 */
router.get(
  '/orders',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.getAllOrders
);

/**
 * @route   GET /api/admin/orders/:orderId
 * @desc    Get order details
 * @access  Admin, Super Admin
 */
router.get(
  '/orders/:orderId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.getOrderById
);

/**
 * @route   PATCH /api/admin/orders/:orderId/status
 * @desc    Update order status
 * @access  Admin, Super Admin
 * @body    status, notes
 */
router.patch(
  '/orders/:orderId/status',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.updateOrderStatus
);

/**
 * @route   POST /api/admin/orders/:orderId/cancel
 * @desc    Cancel order with stock rollback
 * @access  Admin, Super Admin
 * @body    reason, notes
 */
router.post(
  '/orders/:orderId/cancel',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.cancelOrder
);

/**
 * @route   POST /api/admin/orders/:orderId/refund
 * @desc    Process refund
 * @access  Super Admin only
 * @body    reason, notes, refundAmount
 */
router.post(
  '/orders/:orderId/refund',
  superAdminOnly,
  adminOrdersController.processRefund
);

/**
 * @route   POST /api/admin/orders/:orderId/notes
 * @desc    Add note to order
 * @access  Admin, Super Admin
 * @body    note, isInternal
 */
router.post(
  '/orders/:orderId/notes',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.addOrderNote
);

/**
 * @route   GET /api/admin/orders/:orderId/history
 * @desc    Get order history
 * @access  Admin, Super Admin
 */
router.get(
  '/orders/:orderId/history',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.getOrderHistory
);

/**
 * @route   GET /api/admin/orders/number/:orderNumber
 * @desc    Get order by order number
 * @access  Admin, Super Admin
 */
router.get(
  '/orders/number/:orderNumber',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.getOrderByNumber
);

/**
 * @route   GET /api/admin/orders/export/csv
 * @desc    Export orders to CSV
 * @access  Admin, Super Admin
 * @query   status, dateFrom, dateTo
 */
router.get(
  '/orders/export/csv',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.exportOrders
);

/**
 * @route   GET /api/admin/orders/dashboard/summary
 * @desc    Get orders dashboard
 * @access  Admin, Super Admin
 * @query   period (day, week, month, year)
 */
router.get(
  '/orders/dashboard/summary',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.getOrdersDashboard
);

/**
 * @route   GET /api/admin/orders/abnormal/list
 * @desc    Get abnormal orders
 * @access  Admin, Super Admin
 */
router.get(
  '/orders/abnormal/list',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.getAbnormalOrders
);

/**
 * @route   POST /api/admin/orders/create
 * @desc    Create manual order (admin-initiated)
 * @access  Admin, Super Admin
 * @body    userId, items, shippingAddress, billingAddress, notes
 */
router.post(
  '/orders/create',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminOrdersController.createManualOrder
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. COURSE / LESSON / INSTRUCTOR / ENROLLMENT MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get(
  '/instructors',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.getInstructors
);

router.patch(
  '/instructors/:userId/approve',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.approveInstructor
);

router.patch(
  '/instructors/:userId/suspend',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.suspendInstructor
);

router.get(
  '/instructors/:userId/courses',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.getInstructorCourses
);

router.get(
  '/instructors/:userId/revenue',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.getInstructorRevenue
);

router.get(
  '/enrollments',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.getEnrollments
);

router.get(
  '/enrollments/:enrollmentId/progress',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.getEnrollmentProgress
);

router.delete(
  '/enrollments/:enrollmentId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.removeEnrollment
);

router.get(
  '/courses',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.getCourses
);

router.post(
  '/courses',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.createCourse
);

router.patch(
  '/courses/:courseId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.updateCourse
);

router.patch(
  '/courses/:courseId/approve',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.approveCourse
);

router.delete(
  '/courses/:courseId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.deleteCourse
);

router.post(
  '/sections',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.createSection
);

router.patch(
  '/sections/:sectionId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.updateSection
);

router.delete(
  '/sections/:sectionId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.deleteSection
);

router.get(
  '/lessons',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.getLessons
);

router.post(
  '/lessons',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.createLesson
);

router.patch(
  '/lessons/:lessonId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.updateLesson
);

router.delete(
  '/lessons/:lessonId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminLearningController.deleteLesson
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. MEDIA MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.get(
  '/media',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminMediaController.listMedia
);

router.post(
  '/media',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminMediaController.uploadMedia
);

router.delete(
  '/media/:mediaId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  adminMediaController.deleteMedia
);

export default router;
