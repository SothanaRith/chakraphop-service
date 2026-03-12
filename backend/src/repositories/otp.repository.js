// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OTP REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const countOtpsSince = async (email, windowStart) =>
  executeOne(
    `SELECT COUNT(*) AS total
       FROM otp_verifications
      WHERE email = ? AND createdAt >= ?`,
    [email, windowStart]
  );

export const expireActiveOtps = async (email, type) =>
  execute(
    `UPDATE otp_verifications
        SET expiresAt = NOW()
      WHERE email = ?
        AND type = ?
        AND verifiedAt IS NULL
        AND expiresAt >= NOW()`,
    [email, type]
  );

export const insertOtp = async (data) => {
  const {
    id,
    userId,
    email,
    type,
    otpHash,
    maxAttempts,
    expiresAt,
    ipAddress,
    userAgent,
  } = data;

  await execute(
    `INSERT INTO otp_verifications
        (id, userId, email, type, otpHash, attempts, maxAttempts, expiresAt,
         ipAddress, userAgent, createdAt)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW())`,
    [
      id,
      userId || null,
      email,
      type,
      otpHash,
      maxAttempts,
      expiresAt,
      ipAddress || null,
      userAgent || null,
    ]
  );
};

export const getLatestActiveOtp = async (email, type) =>
  executeOne(
    `SELECT *
       FROM otp_verifications
      WHERE email = ?
        AND type = ?
        AND verifiedAt IS NULL
        AND expiresAt >= NOW()
      ORDER BY createdAt DESC
      LIMIT 1`,
    [email, type]
  );

export const incrementOtpAttempts = async (otpId) =>
  execute(
    `UPDATE otp_verifications
        SET attempts = attempts + 1
      WHERE id = ?`,
    [otpId]
  );

export const markOtpVerified = async (otpId) =>
  execute(
    `UPDATE otp_verifications
        SET verifiedAt = NOW()
      WHERE id = ?`,
    [otpId]
  );

export const findRecentOtp = async (email, type, windowStart) =>
  executeOne(
    `SELECT id, createdAt
       FROM otp_verifications
      WHERE email = ?
        AND type = ?
        AND createdAt >= ?
      ORDER BY createdAt DESC
      LIMIT 1`,
    [email, type, windowStart]
  );

export const deleteExpiredOtps = async (cutoffDate) =>
  execute(
    `DELETE FROM otp_verifications
      WHERE expiresAt < NOW()
        AND createdAt < ?`,
    [cutoffDate]
  );

export const insertSecurityLog = async (data) => {
  const { userId, event, severity, details, ipAddress, userAgent } = data;
  await execute(
    `INSERT INTO security_logs
        (id, userId, event, severity, details, ipAddress, userAgent, createdAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())`,
    [
      userId || null,
      event,
      severity || 'INFO',
      details || null,
      ipAddress || null,
      userAgent || null,
    ]
  );
};
