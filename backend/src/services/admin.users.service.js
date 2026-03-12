// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: USER & ROLE MANAGEMENT SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// User lifecycle and role management with audit trail
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import crypto from 'node:crypto';
import { hashPassword } from '../utils/password.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors.js';
import logger from '../config/logger.js';
import {
  countUsers,
  createUser,
  findUserByEmail,
  findUserByEmailExcludingId,
  findUserById,
  listUsers,
  setUserActive,
  updateUserFields,
  updateUserPassword,
  updateUserRole as updateUserRoleRepo,
} from '../repositories/user.repository.js';
import {
  countAdminActionLogs,
  insertAdminActionLog,
  listAdminActionLogs,
} from '../repositories/admin.actions.repository.js';

// Role-based permission matrix
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: {
    users: ['read', 'create', 'update', 'delete', 'manage_roles'],
    products: ['read', 'create', 'update', 'delete', 'publish'],
    inventory: ['read', 'write', 'adjust', 'approve'],
    orders: ['read', 'update', 'cancel', 'refund'],
    reports: ['read', 'export'],
    system: ['read', 'manage']
  },
  ADMIN: {
    users: ['read', 'create', 'update'],
    products: ['read', 'create', 'update', 'publish'],
    inventory: ['read', 'write', 'adjust'],
    orders: ['read', 'update', 'cancel'],
    reports: ['read', 'export'],
    system: ['read']
  },
  INVENTORY_MANAGER: {
    users: ['read'],
    products: ['read'],
    inventory: ['read', 'write', 'adjust'],
    orders: ['read'],
    reports: ['read']
  },
  SALES_AGENT: {
    users: ['read'],
    products: ['read'],
    inventory: ['read'],
    orders: ['read', 'update'],
    reports: ['read']
  }
};

class AdminUsersService {
  /**
   * Get all users with pagination and filtering
   */
  async getAllUsers({ role, status, page = 1, limit = 20, search }) {
    const isActive = status === 'active' ? true : status === 'inactive' ? false : null;

    const [users, total] = await Promise.all([
      listUsers({ role, isActive, search, limit, offset: (page - 1) * limit }),
      countUsers({ role, isActive, search })
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total: total?.total || 0,
        totalPages: Math.ceil((total?.total || 0) / limit)
      }
    };
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
   * Create new admin user with validation
   */
  async createUser({ email, password, firstName, lastName, role }, adminUserId) {
    // Validate role
    if (!ROLE_PERMISSIONS[role]) {
      throw new ValidationError(`Invalid role: ${role}`);
    }

    // Check if email already exists
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      throw new ValidationError('Email already in use');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await createUser({
      id: crypto.randomUUID(),
      email,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      role,
      isActive: true,
      isEmailVerified: true,
      authProvider: 'EMAIL',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Log action
    await this._logAdminAction(adminUserId, 'CREATE_USER', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    logger.info('Admin user created', {
      userId: user.id,
      email: user.email,
      role: user.role,
      createdBy: adminUserId
    });

    return user;
  }

  /**
   * Update user information
   */
  async updateUser(userId, { firstName, lastName, email, role }, adminUserId) {
    const user = await this.getUserById(userId);

    // Validate new role if provided
    if (role && !ROLE_PERMISSIONS[role]) {
      throw new ValidationError(`Invalid role: ${role}`);
    }

    // Check if new email is available
    if (email && email !== user.email) {
      const existing = await findUserByEmailExcludingId(email, userId);

      if (existing) {
        throw new ValidationError('Email already in use');
      }
    }

    const updated = await updateUserFields(userId, {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email && { email, isEmailVerified: 0, emailVerifiedAt: null }),
      ...(role && { role })
    });

    // Log action
    await this._logAdminAction(adminUserId, 'UPDATE_USER', {
      userId,
      changes: { firstName, lastName, email, role }
    });

    logger.info('Admin user updated', {
      userId,
      updatedBy: adminUserId
    });

    return updated;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId, newRole, adminUserId) {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!ROLE_PERMISSIONS[newRole]) {
      throw new ValidationError(`Invalid role: ${newRole}`);
    }

    const updated = await updateUserRoleRepo(userId, newRole);

    // Log action
    await this._logAdminAction(adminUserId, 'CHANGE_ROLE', {
      userId,
      fromRole: user.role,
      toRole: newRole
    });

    logger.warn('User role changed', {
      userId,
      fromRole: user.role,
      toRole: newRole,
      changedBy: adminUserId
    });

    return updated;
  }

  /**
   * Disable user account
   */
  async disableUser(userId, reason, adminUserId) {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await setUserActive(userId, false);
    const updated = await findUserById(userId);

    // Log action
    await this._logAdminAction(adminUserId, 'DISABLE_USER', {
      userId,
      reason: reason || 'Not specified'
    });

    logger.warn('User account disabled', {
      userId,
      reason: reason || 'Not specified',
      disabledBy: adminUserId
    });

    return updated;
  }

  /**
   * Enable user account
   */
  async enableUser(userId, adminUserId) {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await setUserActive(userId, true);
    const updated = await findUserById(userId);

    // Log action
    await this._logAdminAction(adminUserId, 'ENABLE_USER', {
      userId
    });

    logger.info('User account enabled', {
      userId,
      enabledBy: adminUserId
    });

    return updated;
  }

  /**
   * Reset user password
   */
  async resetUserPassword(userId, newPassword, adminUserId) {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hashedPassword = await hashPassword(newPassword);

    await updateUserPassword(userId, hashedPassword);

    // Log action
    await this._logAdminAction(adminUserId, 'RESET_PASSWORD', {
      userId
    });

    logger.warn('User password reset by admin', {
      userId,
      resetBy: adminUserId
    });
  }

  /**
   * Get admin activity log
   */
  async getActivityLog({ userId, action, page = 1, limit = 50, startDate, endDate }) {
    const skip = (page - 1) * limit;

    const where = {};
    if (userId) where.adminId = userId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      listAdminActionLogs({ adminId: userId, action, startDate, endDate, limit, offset: skip }),
      countAdminActionLogs({ adminId: userId, action, startDate, endDate })
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total: total?.total || 0,
        totalPages: Math.ceil((total?.total || 0) / limit)
      }
    };
  }

  /**
   * Get role permissions matrix
   */
  getRolePermissions() {
    return ROLE_PERMISSIONS;
  }

  /**
   * Log admin action for audit trail
   */
  async _logAdminAction(adminId, action, metadata) {
    try {
      await insertAdminActionLog(adminId, action, JSON.stringify(metadata));
    } catch (error) {
      logger.error('Failed to log admin action', { error, adminId, action });
    }
  }
}

export default new AdminUsersService();
