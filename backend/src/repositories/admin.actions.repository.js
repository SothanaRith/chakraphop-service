// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ACTION LOG REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const insertAdminActionLog = async (adminId, action, metadata) =>
  execute(
    `INSERT INTO admin_action_log
        (id, adminId, action, metadata, createdAt)
     VALUES (UUID(), ?, ?, ?, NOW())`,
    [adminId, action, metadata || null]
  );

export const listAdminActionLogs = async ({ adminId, action, startDate, endDate, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (adminId) {
    conditions.push('adminId = ?');
    params.push(adminId);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (startDate) {
    conditions.push('createdAt >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('createdAt <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return execute(
    `SELECT id, adminId, action, metadata, createdAt
       FROM admin_action_log
       ${whereClause}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countAdminActionLogs = async ({ adminId, action, startDate, endDate }) => {
  const conditions = [];
  const params = [];

  if (adminId) {
    conditions.push('adminId = ?');
    params.push(adminId);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (startDate) {
    conditions.push('createdAt >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('createdAt <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executeOne(
    `SELECT COUNT(*) AS total FROM admin_action_log ${whereClause}`,
    params
  );
};
