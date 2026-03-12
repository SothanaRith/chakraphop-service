// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import userService from '../services/user.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class UserController {
  /**
   * Get current user profile
   * GET /api/users/profile
   */
  getProfile = asyncHandler(async (req, res) => {
    const user = await userService.getUserProfile(req.user.id);
    res.json(success(user));
  });

  /**
   * Update profile
   * PATCH /api/users/profile
   */
  updateProfile = asyncHandler(async (req, res) => {
    const user = await userService.updateProfile(req.user.id, req.body);
    res.json(success(user, 'Profile updated successfully'));
  });

  /**
   * Change password
   * POST /api/users/change-password
   */
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(success(null, 'Password changed successfully'));
  });

  /**
   * Add address
   * POST /api/users/addresses
   */
  addAddress = asyncHandler(async (req, res) => {
    const address = await userService.addAddress(req.user.id, req.body);
    res.status(201).json(success(address, 'Address added successfully'));
  });

  /**
   * Update address
   * PATCH /api/users/addresses/:id
   */
  updateAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const address = await userService.updateAddress(req.user.id, id, req.body);
    res.json(success(address, 'Address updated successfully'));
  });

  /**
   * Delete address
   * DELETE /api/users/addresses/:id
   */
  deleteAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await userService.deleteAddress(req.user.id, id);
    res.json(success(null, 'Address deleted successfully'));
  });

  /**
   * Get user orders
   * GET /api/users/orders
   */
  getOrders = asyncHandler(async (req, res) => {
    const result = await userService.getOrders(req.user.id, req.query);
    res.json(success(result));
  });

  /**
   * Get order by ID
   * GET /api/users/orders/:id
   */
  getOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await userService.getOrderById(req.user.id, id);
    res.json(success(order));
  });

  /**
   * Get all users (admin)
   * GET /api/users
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const result = await userService.getAllUsers(req.query);
    res.json(success(result));
  });

  /**
   * Update user role (admin)
   * PATCH /api/users/:id/role
   */
  updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const user = await userService.updateUserRole(id, role);
    res.json(success(user, 'User role updated successfully'));
  });

  /**
   * Toggle user status (admin)
   * PATCH /api/users/:id/status
   */
  toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const user = await userService.toggleUserStatus(id, isActive);
    res.json(success(user, 'User status updated successfully'));
  });
}

export default new UserController();
