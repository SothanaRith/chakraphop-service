// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: USER & ROLE MANAGEMENT CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Protected admin endpoints for user and role management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import adminUsersService from '../services/admin.users.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AdminUsersController {
  /**
   * Get all admin users with filtering and pagination
   * GET /api/admin/users
   * Query: role, status, page, limit, search
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const { role, status, page = 1, limit = 20, search } = req.query;
    
    const result = await adminUsersService.getAllUsers({
      role,
      status,
      page: parseInt(page),
      limit: parseInt(limit),
      search
    });

    res.json(success(result, 'Users retrieved successfully'));
  });

  /**
   * Get user details
   * GET /api/admin/users/:userId
   */
  getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await adminUsersService.getUserById(userId);
    res.json(success(user, 'User retrieved successfully'));
  });

  /**
   * Create new admin user
   * POST /api/admin/users
   * Body: email, password, firstName, lastName, role
   */
  createUser = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, role } = req.body;
    
    const user = await adminUsersService.createUser(
      {
        email,
        password,
        firstName,
        lastName,
        role
      },
      req.user.id // Admin performing action
    );

    res.status(201).json(success(user, 'User created successfully'));
  });

  /**
   * Update user details
   * PATCH /api/admin/users/:userId
   * Body: firstName, lastName, email, role
   */
  updateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { firstName, lastName, email, role } = req.body;

    const user = await adminUsersService.updateUser(
      userId,
      { firstName, lastName, email, role },
      req.user.id
    );

    res.json(success(user, 'User updated successfully'));
  });

  /**
   * Update user role
   * PATCH /api/admin/users/:userId/role
   * Body: role
   */
  updateUserRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await adminUsersService.updateUserRole(
      userId,
      role,
      req.user.id
    );

    res.json(success(user, 'User role updated successfully'));
  });

  /**
   * Disable user account
   * POST /api/admin/users/:userId/disable
   * Body: reason (optional)
   */
  disableUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await adminUsersService.disableUser(
      userId,
      reason,
      req.user.id
    );

    res.json(success(user, 'User account disabled successfully'));
  });

  /**
   * Re-enable user account
   * POST /api/admin/users/:userId/enable
   */
  enableUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await adminUsersService.enableUser(userId, req.user.id);

    res.json(success(user, 'User account enabled successfully'));
  });

  /**
   * Reset user password
   * POST /api/admin/users/:userId/reset-password
   * Body: newPassword
   */
  resetUserPassword = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    await adminUsersService.resetUserPassword(
      userId,
      newPassword,
      req.user.id
    );

    res.json(success(null, 'User password reset successfully'));
  });

  /**
   * Get admin activity history
   * GET /api/admin/activity
   * Query: userId, action, page, limit, startDate, endDate
   */
  getActivityLog = asyncHandler(async (req, res) => {
    const { userId, action, page = 1, limit = 50, startDate, endDate } = req.query;

    const result = await adminUsersService.getActivityLog({
      userId,
      action,
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate
    });

    res.json(success(result, 'Activity log retrieved successfully'));
  });

  /**
   * Get role permissions matrix
   * GET /api/admin/roles/permissions
   */
  getRolePermissions = asyncHandler(async (req, res) => {
    const permissions = await adminUsersService.getRolePermissions();
    res.json(success(permissions, 'Role permissions retrieved successfully'));
  });
}

export default new AdminUsersController();
