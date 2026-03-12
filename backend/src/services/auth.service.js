// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { randomUUID } from 'crypto';
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLogin,
  updateUserPassword,
  updateUserProfile,
} from '../repositories/user.repository.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { ConflictError, AuthenticationError, NotFoundError } from '../utils/errors.js';
import logger from '../config/logger.js';

class AuthService {
  /**
   * Register new user
   */
  async register(userData) {
    const { email, password, firstName, lastName, role = 'CUSTOMER' } = userData;

    // Check if user already exists
    const existingUser = await findUserByEmail(email.toLowerCase());

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = randomUUID();

    const user = await createUser({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      isActive: true,
      isEmailVerified: false,
      authProvider: 'EMAIL',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    delete user.passwordHash;

    logger.info('User registered', { userId: user.id, email: user.email });

    return user;
  }

  /**
   * Login user
   */
  async login(email, password, ipAddress, userAgent) {
    // Find user
    const user = await findUserByEmail(email.toLowerCase());

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated. Please contact support.');
    }

    // Update last login
    await updateLastLogin(user.id, ipAddress);

    // Remove sensitive data
    delete user.passwordHash;

    logger.info('User logged in', { 
      userId: user.id, 
      email: user.email,
      ip: ipAddress
    });

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await findUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    const { firstName, lastName, phone } = updates;

    const user = await updateUserProfile(userId, {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(phone !== undefined ? { phone } : {}),
    });

    logger.info('User profile updated', { userId });

    return user;
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await findUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await updateUserPassword(userId, newPasswordHash);

    logger.info('Password changed', { userId });

    return { success: true };
  }
}

export default new AuthService();
