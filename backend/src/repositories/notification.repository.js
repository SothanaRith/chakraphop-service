// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const insertUserNotification = async (data) => {
  const { userId, type, channel, subject, body, relatedEntityType, relatedEntityId } = data;
  await execute(
    `INSERT INTO user_notifications
        (id, userId, type, channel, subject, body, relatedEntityType, relatedEntityId, sentAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      userId,
      type,
      channel,
      subject || null,
      body,
      relatedEntityType || null,
      relatedEntityId || null,
    ]
  );

  return executeOne(
    `SELECT * FROM user_notifications WHERE userId = ? ORDER BY sentAt DESC LIMIT 1`,
    [userId]
  );
};

export const insertEmailLog = async (data) => {
  const { recipient, subject, body, status, userId } = data;
  return execute(
    `INSERT INTO email_logs
        (id, recipient, subject, body, status, userId, createdAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, NOW())`,
    [recipient, subject, body, status, userId || null]
  );
};

export const getUserEmailById = async (userId) =>
  executeOne(
    `SELECT email FROM users WHERE id = ?`,
    [userId]
  );

export const listUserNotifications = async ({ userId, isRead, limit, offset }) => {
  const conditions = ['userId = ?'];
  const params = [userId];

  if (isRead !== null && isRead !== undefined) {
    conditions.push('isRead = ?');
    params.push(isRead ? 1 : 0);
  }

  return execute(
    `SELECT *
       FROM user_notifications
      WHERE ${conditions.join(' AND ')}
      ORDER BY sentAt DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countUserNotifications = async ({ userId, isRead }) => {
  const conditions = ['userId = ?'];
  const params = [userId];

  if (isRead !== null && isRead !== undefined) {
    conditions.push('isRead = ?');
    params.push(isRead ? 1 : 0);
  }

  return executeOne(
    `SELECT COUNT(*) AS total FROM user_notifications WHERE ${conditions.join(' AND ')}`,
    params
  );
};

export const markNotificationRead = async (notificationId, userId) =>
  execute(
    `UPDATE user_notifications
        SET isRead = 1, readAt = NOW()
      WHERE id = ? AND userId = ?`,
    [notificationId, userId]
  );

export const markAllNotificationsRead = async (userId) =>
  execute(
    `UPDATE user_notifications
        SET isRead = 1, readAt = NOW()
      WHERE userId = ? AND isRead = 0`,
    [userId]
  );

export const countUnreadNotifications = async (userId) =>
  executeOne(
    `SELECT COUNT(*) AS total FROM user_notifications WHERE userId = ? AND isRead = 0`,
    [userId]
  );

export const deleteUserNotification = async (notificationId, userId) =>
  execute(
    `DELETE FROM user_notifications WHERE id = ? AND userId = ?`,
    [notificationId, userId]
  );
