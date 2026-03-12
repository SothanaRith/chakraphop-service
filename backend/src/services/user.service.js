// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NotFoundError, ValidationError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import logger from '../config/logger.js';
import { withTransaction } from '../db/index.js';
import {
  countOrdersByUser,
  getOrderItems,
  getOrderPayments,
  getOrderById as getOrderByIdRepo,
  listOrdersByUser,
} from '../repositories/order.repository.js';
import {
  findUserByEmailExcludingId,
  findUserById,
  listUsers,
  countUsers,
  setUserActive,
  updateUserFields,
  updateUserPassword,
  updateUserRole,
} from '../repositories/user.repository.js';
import {
  clearDefaultAddresses,
  deleteAddress as deleteAddressRepo,
  getAddressById,
  insertAddress,
  listAddressesByUserId,
  updateAddress as updateAddressRepo,
} from '../repositories/address.repository.js';

class UserService {
  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    const user = await findUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const addresses = await listAddressesByUserId(userId);

    return {
      ...user,
      phoneNumber: user.phone || null,
      addresses,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    const { email, firstName, lastName, phoneNumber } = updates;

    // If email is being changed, check uniqueness
    if (email) {
      const existing = await findUserByEmailExcludingId(email, userId);

      if (existing) {
        throw new ValidationError('Email already in use');
      }
    }

    const updatePayload = {
      ...(email && { email, isEmailVerified: 0, emailVerifiedAt: null }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phoneNumber !== undefined && { phone: phoneNumber })
    };

    const user = await updateUserFields(userId, updatePayload);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info('User profile updated', { userId });

    return {
      ...user,
      phoneNumber: user.phone || null,
    };
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await findUserById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.passwordHash) {
      throw new ValidationError('Unable to change password');
    }

    // Verify current password
    const bcrypt = await import('bcrypt');
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    await updateUserPassword(userId, passwordHash);

    logger.info('Password changed', { userId });

    return { message: 'Password changed successfully' };
  }

  /**
   * Add address
   */
  async addAddress(userId, addressData) {
    const { isDefault, ...data } = addressData;

    return withTransaction(async (connection) => {
      if (isDefault) {
        await clearDefaultAddresses(userId, null, connection);
      }

      const address = await insertAddress(
        userId,
        { ...data, isDefault: isDefault || false },
        connection
      );

      logger.info('Address added', { userId, addressId: address.id });

      return address;
    });
  }

  /**
   * Update address
   */
  async updateAddress(userId, addressId, updates) {
    const { isDefault, ...data } = updates;

    return withTransaction(async (connection) => {
      const address = await getAddressById(userId, addressId);

      if (!address) {
        throw new NotFoundError('Address not found');
      }

      if (isDefault) {
        await clearDefaultAddresses(userId, addressId, connection);
      }

      return updateAddressRepo(
        addressId,
        {
          ...data,
          ...(isDefault !== undefined && { isDefault: isDefault ? 1 : 0 })
        },
        connection
      );
    });
  }

  /**
   * Delete address
   */
  async deleteAddress(userId, addressId) {
    const address = await getAddressById(userId, addressId);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    await deleteAddressRepo(addressId);

    logger.info('Address deleted', { userId, addressId });

    return { message: 'Address deleted' };
  }

  /**
   * Get user orders
   */
  async getOrders(userId, filters = {}) {
    const { page = 1, limit = 10, status } = filters;
    const [orders, total] = await Promise.all([
      listOrdersByUser(userId, page, limit, status),
      countOrdersByUser(userId, status)
    ]);

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const [items, payments, shippingAddress] = await Promise.all([
          getOrderItems(order.id),
          getOrderPayments(order.id),
          order.shippingAddressId ? getAddressById(userId, order.shippingAddressId) : null
        ]);

        return {
          ...order,
          items,
          shippingAddress,
          payments,
        };
      })
    );

    return {
      orders: ordersWithDetails,
      pagination: {
        page,
        limit,
        total: total?.total || 0,
        totalPages: Math.ceil((total?.total || 0) / limit)
      }
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(userId, orderId) {
    const order = await getOrderByIdRepo(orderId);

    if (!order || order.userId !== userId) {
      throw new NotFoundError('Order not found');
    }

    const [items, payments, shippingAddress] = await Promise.all([
      getOrderItems(order.id),
      getOrderPayments(order.id),
      order.shippingAddressId ? getAddressById(userId, order.shippingAddressId) : null
    ]);

    return {
      ...order,
      items,
      payments,
      shippingAddress,
    };
  }

  /**
   * Get all users (admin)
   */
  async getAllUsers(filters = {}) {
    const { page = 1, limit = 20, role, isActive, search } = filters;
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
   * Update user role (admin)
   */
  async updateUserRole(userId, role) {
    const validRoles = ['CUSTOMER', 'SALES_AGENT', 'INVENTORY_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role');
    }

    const user = await updateUserRole(userId, role);

    logger.info('User role updated', { userId, role });

    return user;
  }

  /**
   * Activate/deactivate user (admin)
   */
  async toggleUserStatus(userId, isActive) {
    await setUserActive(userId, isActive);
    const user = await findUserById(userId);

    logger.info('User status updated', { userId, isActive });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      ...user,
      phoneNumber: user.phone || null,
    };
  }
}

export default new UserService();
