// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { query } from '../db/index.js';
import { execute, executeOne } from '../db/index.js';

export const findUserByEmail = async (email) => {
  const rows = await query(
    `SELECT id, email, passwordHash, role, isActive, firstName, lastName, phone,
            isEmailVerified, createdAt, lastLoginAt, lastLoginIp
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [email]
  );
  return rows[0] || null;
};

export const findUserByEmailExcludingId = async (email, userId) =>
  executeOne(
    `SELECT id, email FROM users WHERE email = ? AND id <> ? LIMIT 1`,
    [email, userId]
  );

export const findUserAuthByEmail = async (email) =>
  executeOne(
    `SELECT id, email, passwordHash, role, isActive, isEmailVerified,
            failedLoginAttempts, accountLockedUntil, twoFactorEnabled,
            googleId, authProvider, emailVerifiedAt
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [email]
  );

export const findUserByGoogleId = async (googleId) =>
  executeOne(
    `SELECT id, email, passwordHash, role, isActive, isEmailVerified,
            failedLoginAttempts, accountLockedUntil, twoFactorEnabled,
            googleId, authProvider, emailVerifiedAt
       FROM users
      WHERE googleId = ?
      LIMIT 1`,
    [googleId]
  );

export const findUserById = async (id) => {
  const rows = await query(
    `SELECT id, email, passwordHash, role, isActive, firstName, lastName, phone,
            isEmailVerified, createdAt, lastLoginAt, lastLoginIp
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const createUser = async (data) => {
  const {
    id,
    email,
    passwordHash,
    firstName,
    lastName,
    role,
    isActive,
    isEmailVerified,
    authProvider,
    createdAt,
    updatedAt,
  } = data;

  await query(
    `INSERT INTO users (id, email, passwordHash, firstName, lastName, role, isActive,
                        isEmailVerified, authProvider, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      id,
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      isActive,
      isEmailVerified,
      authProvider,
      createdAt,
      updatedAt,
    ]
  );

  return findUserById(id);
};

export const updateUserProfile = async (id, updates) => {
  const fields = [];
  const values = [];

  if (updates.firstName !== undefined) {
    fields.push('firstName = ?');
    values.push(updates.firstName);
  }
  if (updates.lastName !== undefined) {
    fields.push('lastName = ?');
    values.push(updates.lastName);
  }
  if (updates.phone !== undefined) {
    fields.push('phone = ?');
    values.push(updates.phone);
  }

  if (fields.length === 0) {
    return findUserById(id);
  }

  values.push(id);

  await query(
    `UPDATE users SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return findUserById(id);
};

export const updateUserFields = async (id, updates) => {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return findUserById(id);

  values.push(id);

  await query(
    `UPDATE users SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return findUserById(id);
};

export const updateUserPassword = async (id, passwordHash) => {
  await query(
    `UPDATE users SET passwordHash = ?, lastPasswordChange = NOW(), updatedAt = NOW() WHERE id = ?`,
    [passwordHash, id]
  );
};

export const resetPasswordSecurity = async (id, passwordHash) =>
  execute(
    `UPDATE users
        SET passwordHash = ?,
            lastPasswordChange = NOW(),
            failedLoginAttempts = 0,
            accountLockedUntil = NULL,
            updatedAt = NOW()
      WHERE id = ?`,
    [passwordHash, id]
  );

export const updateLastLogin = async (id, ipAddress) => {
  await query(
    `UPDATE users SET lastLoginAt = NOW(), lastLoginIp = ?, updatedAt = NOW() WHERE id = ?`,
    [ipAddress, id]
  );
};

export const updateLoginFailure = async (id, failedAttempts, accountLockedUntil) =>
  execute(
    `UPDATE users
        SET failedLoginAttempts = ?, accountLockedUntil = ?, updatedAt = NOW()
      WHERE id = ?`,
    [failedAttempts, accountLockedUntil, id]
  );

export const resetLoginFailures = async (id, ipAddress) =>
  execute(
    `UPDATE users
        SET failedLoginAttempts = 0,
            accountLockedUntil = NULL,
            lastLoginAt = NOW(),
            lastLoginIp = ?,
            updatedAt = NOW()
      WHERE id = ?`,
    [ipAddress, id]
  );

export const updateEmailVerification = async (id, verifiedAt) =>
  execute(
    `UPDATE users
        SET isEmailVerified = 1,
            emailVerifiedAt = ?,
            updatedAt = NOW()
      WHERE id = ?`,
    [verifiedAt, id]
  );

export const linkGoogleAccount = async (id, googleId, verifiedAt) =>
  execute(
    `UPDATE users
        SET googleId = ?,
            isEmailVerified = 1,
            emailVerifiedAt = ?,
            updatedAt = NOW()
      WHERE id = ?`,
    [googleId, verifiedAt, id]
  );

export const setUserActive = async (id, isActive) => {
  await query(
    `UPDATE users SET isActive = ?, updatedAt = NOW() WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
};

export const listUsers = async ({ role, isActive, search, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (isActive !== undefined && isActive !== null) {
    conditions.push('isActive = ?');
    params.push(isActive ? 1 : 0);
  }
  if (search) {
    conditions.push('(email LIKE ? OR firstName LIKE ? OR lastName LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT id, email, firstName, lastName, role, isActive, isEmailVerified,
            createdAt, lastLoginAt
       FROM users
       ${whereClause}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countUsers = async ({ role, isActive, search }) => {
  const conditions = [];
  const params = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (isActive !== undefined && isActive !== null) {
    conditions.push('isActive = ?');
    params.push(isActive ? 1 : 0);
  }
  if (search) {
    conditions.push('(email LIKE ? OR firstName LIKE ? OR lastName LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executeOne(
    `SELECT COUNT(*) AS total FROM users ${whereClause}`,
    params
  );
};

export const updateUserRole = async (id, role) => {
  await execute(
    `UPDATE users SET role = ?, updatedAt = NOW() WHERE id = ?`,
    [role, id]
  );

  return findUserById(id);
};

export const listUsersByRoles = async (roles) => {
  if (!roles || roles.length === 0) return [];

  return execute(
    `SELECT id, email, firstName, lastName, role, isActive
       FROM users
      WHERE role IN (${roles.map(() => '?').join(', ')}) AND isActive = 1`,
    roles
  );
};

export const updateTwoFactorEnabled = async (id, enabled) =>
  execute(
    `UPDATE users SET twoFactorEnabled = ?, updatedAt = NOW() WHERE id = ?`,
    [enabled ? 1 : 0, id]
  );
