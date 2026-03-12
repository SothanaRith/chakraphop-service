// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OTP VERIFICATION SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Secure, production-grade OTP generation and verification
// Features:
// - Cryptographically secure OTP generation
// - Hashed storage (never store plain OTP)
// - Rate limiting and brute-force protection
// - Automatic expiration
// - Attempt tracking
// - Security logging
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { AppError } from '../utils/errors.js';
import {
  countOtpsSince,
  expireActiveOtps,
  findRecentOtp,
  getLatestActiveOtp,
  incrementOtpAttempts,
  insertOtp,
  insertSecurityLog,
  markOtpVerified,
  deleteExpiredOtps,
} from '../repositories/otp.repository.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15; // Max 3 OTPs per 15 minutes per email

/**
 * Generate a cryptographically secure OTP
 * @returns {string} 6-digit OTP
 */
function generateOTP() {
  // Use crypto.randomInt for cryptographically secure random numbers
  const otp = crypto.randomInt(100000, 999999).toString();
  return otp;
}

/**
 * Hash OTP before storing (never store plain text OTPs)
 * @param {string} otp - Plain text OTP
 * @returns {Promise<string>} Hashed OTP
 */
async function hashOTP(otp) {
  const saltRounds = 10; // Less than password (10 vs 12) since OTP is short-lived
  return bcrypt.hash(otp, saltRounds);
}

/**
 * Check rate limiting for OTP requests
 * Prevents abuse: max 3 OTPs per email per 15 minutes
 */
async function checkRateLimit(email) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  
  const recentOTPs = await countOtpsSince(email, windowStart);
  
  if ((recentOTPs?.total || 0) >= 3) {
    throw new AppError(
      `Too many OTP requests. Please try again in ${RATE_LIMIT_WINDOW_MINUTES} minutes.`,
      429
    );
  }
}

/**
 * Create and send OTP for verification
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.type - OTP type (EMAIL_VERIFICATION, LOGIN_2FA, PASSWORD_RESET)
 * @param {string} [params.userId] - User ID if user exists
 * @param {string} [params.ipAddress] - Client IP for security logging
 * @param {string} [params.userAgent] - Client user agent
 * @returns {Promise<Object>} { otpId, expiresAt, plainOTP (for dev only) }
 */
async function createOTP({ email, type, userId = null, ipAddress = null, userAgent = null }) {
  // Check rate limiting
  await checkRateLimit(email);
  
  // Invalidate any existing OTPs for this email/type
  await expireActiveOtps(email, type);
  
  // Generate OTP
  const plainOTP = generateOTP();
  const otpHash = await hashOTP(plainOTP);
  
  // Calculate expiration
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  
  // Store OTP
  const otpId = crypto.randomUUID();
  await insertOtp({
    id: otpId,
    userId,
    email,
    type,
    otpHash,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt,
    ipAddress,
    userAgent
  });
  
  // Security log
  await logSecurityEvent({
    userId,
    event: 'OTP_CREATED',
    severity: 'INFO',
    details: JSON.stringify({
      email,
      type,
      otpId,
      expiresAt
    }),
    ipAddress,
    userAgent
  });
  
  // TODO: Send OTP via email (integrate with email service)
  // For now, we'll return the plain OTP (REMOVE IN PRODUCTION)
  console.log(`[OTP] ${type} for ${email}: ${plainOTP} (expires in ${OTP_EXPIRY_MINUTES} min)`);
  
  return {
    otpId,
    expiresAt,
    // SECURITY WARNING: Remove this in production!
    // Only for development/testing
    ...(process.env.NODE_ENV !== 'production' && { plainOTP })
  };
}

/**
 * Verify OTP code
 * @param {Object} params
 * @param {string} params.email - Email that received the OTP
 * @param {string} params.otp - Plain text OTP from user
 * @param {string} params.type - OTP type to verify
 * @param {string} [params.ipAddress] - Client IP
 * @param {string} [params.userAgent] - Client user agent
 * @returns {Promise<Object>} { success: true, userId, email }
 * @throws {AppError} If OTP is invalid, expired, or max attempts exceeded
 */
async function verifyOTP({ email, otp, type, ipAddress = null, userAgent = null }) {
  // Find active OTP
  const otpRecord = await getLatestActiveOtp(email, type);
  
  if (!otpRecord) {
    await logSecurityEvent({
      userId: null,
      event: 'OTP_VERIFICATION_FAILED',
      severity: 'WARNING',
      details: JSON.stringify({
        email,
        type,
        reason: 'No active OTP found'
      }),
      ipAddress,
      userAgent
    });
    
    throw new AppError('Invalid or expired OTP. Please request a new one.', 400);
  }
  
  // Check max attempts
  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await logSecurityEvent({
      userId: otpRecord.userId,
      event: 'OTP_MAX_ATTEMPTS_EXCEEDED',
      severity: 'CRITICAL',
      details: JSON.stringify({
        email,
        type,
        otpId: otpRecord.id,
        attempts: otpRecord.attempts
      }),
      ipAddress,
      userAgent
    });
    
    throw new AppError('Maximum verification attempts exceeded. Please request a new OTP.', 429);
  }
  
  // Increment attempts
  await incrementOtpAttempts(otpRecord.id);
  
  // Verify OTP
  const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
  
  if (!isValid) {
    await logSecurityEvent({
      userId: otpRecord.userId,
      event: 'OTP_VERIFICATION_FAILED',
      severity: 'WARNING',
      details: JSON.stringify({
        email,
        type,
        otpId: otpRecord.id,
        attempts: otpRecord.attempts + 1
      }),
      ipAddress,
      userAgent
    });
    
    const attemptsLeft = otpRecord.maxAttempts - (otpRecord.attempts + 1);
    throw new AppError(
      `Invalid OTP. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
      400
    );
  }
  
  // Mark as verified
  await markOtpVerified(otpRecord.id);
  
  // Security log
  await logSecurityEvent({
    userId: otpRecord.userId,
    event: 'OTP_VERIFIED_SUCCESS',
    severity: 'INFO',
    details: JSON.stringify({
      email,
      type,
      otpId: otpRecord.id
    }),
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    userId: otpRecord.userId,
    email: otpRecord.email
  };
}

/**
 * Resend OTP (with rate limiting)
 */
async function resendOTP({ email, type, userId = null, ipAddress = null, userAgent = null }) {
  // Same as createOTP, but we check if there's a recent one first
  const recentOTP = await findRecentOtp(
    email,
    type,
    new Date(Date.now() - 2 * 60 * 1000)
  );
  
  if (recentOTP) {
    throw new AppError('Please wait 2 minutes before requesting another OTP.', 429);
  }
  
  return createOTP({ email, type, userId, ipAddress, userAgent });
}

/**
 * Clean up expired OTPs (run periodically via cron)
 */
async function cleanupExpiredOTPs() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await deleteExpiredOtps(cutoff);
  console.log(`[OTP Cleanup] Deleted ${result.affectedRows || 0} expired OTP records`);
  return result.affectedRows || 0;
}

/**
 * Log security events
 */
async function logSecurityEvent({ userId, event, severity, details, ipAddress, userAgent }) {
  try {
    await insertSecurityLog({
      userId,
      event,
      severity,
      details,
      ipAddress,
      userAgent
    });
  } catch (error) {
    console.error('[Security Log] Failed to log event:', error);
    // Don't throw - logging failure shouldn't break the flow
  }
}

export {
  createOTP,
  verifyOTP,
  resendOTP,
  cleanupExpiredOTPs,
  logSecurityEvent
};
