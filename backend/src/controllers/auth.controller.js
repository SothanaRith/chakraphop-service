// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import authService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';

class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    const user = await authService.register({
      email,
      password,
      firstName,
      lastName,
      phoneNumber
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json(
      success({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        accessToken,
        refreshToken
      }, 'User registered successfully')
    );
  });

  /**
   * Login user
   * POST /api/auth/login
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await authService.login(
      email,
      password,
      req.ip,
      req.get('user-agent') || null
    );

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json(
      success({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        accessToken,
        refreshToken
      }, 'Login successful')
    );
  });

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  getMe = asyncHandler(async (req, res) => {
    const user = await authService.getUserById(req.user.id);

    res.json(success(user));
  });

  /**
   * Update profile
   * PATCH /api/auth/profile
   */
  updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, phoneNumber } = req.body;

    const user = await authService.updateProfile(req.user.id, {
      firstName,
      lastName,
      phoneNumber
    });

    res.json(success(user, 'Profile updated successfully'));
  });

  /**
   * Change password
   * POST /api/auth/change-password
   */
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.json(success(null, 'Password changed successfully'));
  });

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    // Verify refresh token
    const jwt = await import('jsonwebtoken');
    const config = await import('../config/index.js');

    try {
      const decoded = jwt.verify(refreshToken, config.default.jwt.refreshSecret);
      
      // Get user
      const user = await authService.getUserById(decoded.userId);

      // Generate new access token
      const accessToken = generateAccessToken(user);

      res.json(success({ accessToken }, 'Token refreshed successfully'));
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  });

  /**
   * Logout (client-side token removal)
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req, res) => {
    res.json(success(null, 'Logout successful'));
  });
}

export default new AuthController();
