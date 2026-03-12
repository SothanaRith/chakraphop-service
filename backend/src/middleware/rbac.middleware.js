// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Granular permission control based on user roles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthorizationError } from '../utils/errors.js';

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  CUSTOMER: 1,
  STUDENT: 1,
  SALES_AGENT: 2,
  INSTRUCTOR: 3,
  INVENTORY_MANAGER: 4,
  ADMIN: 5,
  SUPER_ADMIN: 6,
};

/**
 * Check if user has required role
 * @param {Array<string>} allowedRoles - Array of allowed role names
 * @returns {Function} - Express middleware
 * 
 * Usage:
 * router.get('/admin/products', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), getProducts);
 */
export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required'));
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return next(
        new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};

/**
 * Check if user has minimum role level
 * @param {string} minimumRole - Minimum required role
 * @returns {Function} - Express middleware
 * 
 * Usage:
 * router.post('/admin/categories', authenticate, authorizeMinRole('ADMIN'), createCategory);
 */
export const authorizeMinRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required'));
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return next(
        new AuthorizationError(
          `Access denied. Minimum required role: ${minimumRole}`
        )
      );
    }

    next();
  };
};

/**
 * Check if user is accessing their own resource
 * @param {string} userIdParam - Request parameter name containing user ID
 * @returns {Function} - Express middleware
 * 
 * Usage:
 * router.get('/users/:userId/orders', authenticate, authorizeSelfOrAdmin('userId'), getUserOrders);
 */
export const authorizeSelfOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required'));
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    const isSelf = req.user.id === targetUserId;

    if (!isSelf && !isAdmin) {
      return next(new AuthorizationError('Access denied'));
    }

    next();
  };
};

/**
 * Admin-only access
 */
export const adminOnly = authorize(['ADMIN', 'SUPER_ADMIN']);

/**
 * Super admin only access
 */
export const superAdminOnly = authorize(['SUPER_ADMIN']);

/**
 * Inventory management access
 */
export const inventoryAccess = authorize(['INVENTORY_MANAGER', 'ADMIN', 'SUPER_ADMIN']);
