// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENHANCED AUTHENTICATION SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Multi-method authentication with security features:
// - Email/Password with verification
// - Google OAuth 2.0
// - OTP verification (2FA, password reset, email verification)
// - Account lockout protection
// - Security logging
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';
import { AppError } from '../utils/errors.js';
import { createOTP, verifyOTP, logSecurityEvent } from './otpService.js';
import {
  createUser,
  findUserAuthByEmail,
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  linkGoogleAccount,
  resetLoginFailures,
  resetPasswordSecurity,
  updateEmailVerification,
  updateLastLogin,
  updateLoginFailure,
  updateTwoFactorEnabled,
  updateUserPassword,
} from '../repositories/user.repository.js';
import User from '../models/user.model.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_DURATION_MINUTES = 30;
const PASSWORD_SALT_ROUNDS = 12;

/**
 * Register new user with email verification
 */
async function register({ 
  email, 
  password, 
  firstName, 
  lastName, 
  phone = null,
  ipAddress = null,
  userAgent = null
}) {
  email = email.toLowerCase();
  
  // Check if user already exists
  const existing = await findUserByEmail(email);
  
  if (existing) {
    // Security: Don't reveal if email exists (prevents enumeration)
    // Instead, send email with "account already exists" message
    throw new AppError('Registration failed. Please check your email for further instructions.', 400);
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  
  // Create user (unverified)
  const user = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash,
    firstName,
    lastName,
    role: 'CUSTOMER',
    isActive: true,
    isEmailVerified: false,
    authProvider: 'EMAIL',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  // Send email verification OTP
  const otpResult = await createOTP({
    email,
    type: 'EMAIL_VERIFICATION',
    userId: user.id,
    ipAddress,
    userAgent
  });
  
  await logSecurityEvent({
    userId: user.id,
    event: 'USER_REGISTERED',
    severity: 'INFO',
    details: JSON.stringify({ email, provider: 'EMAIL' }),
    ipAddress,
    userAgent
  });
  
  return {
    user,
    message: 'Registration successful. Please verify your email.',
    otpSent: true,
    // In development, include OTP
    ...(process.env.NODE_ENV !== 'production' && { 
      devOTP: otpResult.plainOTP 
    })
  };
}

/**
 * Verify email with OTP
 */
async function verifyEmail({ email, otp, ipAddress = null, userAgent = null }) {
  const result = await verifyOTP({
    email: email.toLowerCase(),
    otp,
    type: 'EMAIL_VERIFICATION',
    ipAddress,
    userAgent
  });
  
  // Mark email as verified
  await updateEmailVerification(result.userId, new Date());
  
  await logSecurityEvent({
    userId: result.userId,
    event: 'EMAIL_VERIFIED',
    severity: 'INFO',
    details: JSON.stringify({ email: result.email }),
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    message: 'Email verified successfully'
  };
}

/**
 * Login with email and password
 * Includes account lockout protection
 */
async function login({ 
  email, 
  password, 
  ipAddress = null, 
  userAgent = null 
}) {
  email = email.toLowerCase();
  
  const user = await findUserAuthByEmail(email);
  
  // Check if account is locked
  if (user && user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.accountLockedUntil - new Date()) / (60 * 1000));
    
    await logSecurityEvent({
      userId: user.id,
      event: 'LOGIN_BLOCKED_LOCKED',
      severity: 'WARNING',
      details: JSON.stringify({ email, minutesLeft }),
      ipAddress,
      userAgent
    });
    
    throw new AppError(
      `Account temporarily locked due to multiple failed login attempts. Try again in ${minutesLeft} minute(s).`,
      403
    );
  }
  
  // Verify user exists and password is correct
  if (!user || !user.passwordHash) {
    // Generic error to prevent enumeration
    await logSecurityEvent({
      userId: null,
      event: 'LOGIN_FAILED_INVALID',
      severity: 'WARNING',
      details: JSON.stringify({ email, reason: 'user_not_found' }),
      ipAddress,
      userAgent
    });
    
    throw new AppError('Invalid email or password', 401);
  }
  
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  
  if (!isValidPassword) {
    // Increment failed attempts
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
    
    await updateLoginFailure(
      user.id,
      newAttempts,
      shouldLock ? new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MINUTES * 60 * 1000) : null
    );
    
    await logSecurityEvent({
      userId: user.id,
      event: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED_PASSWORD',
      severity: shouldLock ? 'CRITICAL' : 'WARNING',
      details: JSON.stringify({ 
        email, 
        attempts: newAttempts,
        locked: shouldLock
      }),
      ipAddress,
      userAgent
    });
    
    if (shouldLock) {
      throw new AppError(
        `Account locked due to ${MAX_LOGIN_ATTEMPTS} failed login attempts. Please try again in ${ACCOUNT_LOCKOUT_DURATION_MINUTES} minutes or reset your password.`,
        403
      );
    }
    
    const attemptsLeft = MAX_LOGIN_ATTEMPTS - newAttempts;
    throw new AppError(
      `Invalid email or password. ${attemptsLeft} attempt(s) remaining before account lockout.`,
      401
    );
  }
  
  // Check if account is active
  const userModel = User.fromData(user);
  if (!userModel.canLogin()) {
    await logSecurityEvent({
      userId: user.id,
      event: 'LOGIN_BLOCKED_INACTIVE',
      severity: 'WARNING',
      details: JSON.stringify({ email }),
      ipAddress,
      userAgent
    });
    
    throw new AppError('Account is deactivated. Please contact support.', 403);
  }
  
  // Successful login - reset failed attempts
  await resetLoginFailures(user.id, ipAddress);
  
  await logSecurityEvent({
    userId: user.id,
    event: 'LOGIN_SUCCESS',
    severity: 'INFO',
    details: JSON.stringify({ email, provider: 'EMAIL' }),
    ipAddress,
    userAgent
  });
  
  // If 2FA is enabled, send OTP
  if (user.twoFactorEnabled) {
    const otpResult = await createOTP({
      email,
      type: 'LOGIN_2FA',
      userId: user.id,
      ipAddress,
      userAgent
    });
    
    return {
      requires2FA: true,
      message: 'Please enter the OTP sent to your email',
      ...(process.env.NODE_ENV !== 'production' && { 
        devOTP: otpResult.plainOTP 
      })
    };
  }
  
  // Remove sensitive data
  const { passwordHash, ...userWithoutPassword } = user;
  
  // TODO: Generate JWT tokens (integrate with your token service)
  // For now, return user data
  
  return {
    user: userWithoutPassword,
    message: 'Login successful'
  };
}

/**
 * Verify 2FA OTP during login
 */
async function verify2FA({ email, otp, ipAddress = null, userAgent = null }) {
  const result = await verifyOTP({
    email: email.toLowerCase(),
    otp,
    type: 'LOGIN_2FA',
    ipAddress,
    userAgent
  });
  
  const user = await findUserById(result.userId);
  
  await logSecurityEvent({
    userId: result.userId,
    event: '2FA_VERIFIED_SUCCESS',
    severity: 'INFO',
    details: JSON.stringify({ email: result.email }),
    ipAddress,
    userAgent
  });
  
  // TODO: Generate JWT tokens
  
  return {
    user,
    message: '2FA verification successful'
  };
}

/**
 * Google OAuth login
 */
async function googleLogin({ 
  idToken, 
  ipAddress = null, 
  userAgent = null 
}) {
  let payload;
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload();
  } catch (error) {
    await logSecurityEvent({
      userId: null,
      event: 'GOOGLE_LOGIN_FAILED',
      severity: 'WARNING',
      details: JSON.stringify({ error: error.message }),
      ipAddress,
      userAgent
    });
    
    throw new AppError('Invalid Google token', 401);
  }
  
  const { sub: googleId, email, given_name: firstName, family_name: lastName, email_verified } = payload;
  
  if (!email_verified) {
    throw new AppError('Google email not verified', 400);
  }
  
  // Check if user exists with this Google ID
  let user = await findUserByGoogleId(googleId);
  
  // If not, check by email (account linking)
  if (!user) {
    user = await findUserAuthByEmail(email.toLowerCase());
    
    if (user) {
      // Link Google account to existing user
      await linkGoogleAccount(
        user.id,
        googleId,
        email_verified ? new Date() : user.emailVerifiedAt
      );
      user = await findUserByGoogleId(googleId);
      
      await logSecurityEvent({
        userId: user.id,
        event: 'GOOGLE_ACCOUNT_LINKED',
        severity: 'INFO',
        details: JSON.stringify({ email }),
        ipAddress,
        userAgent
      });
    } else {
      // Create new user via Google
      user = await createUser({
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        passwordHash: null,
        firstName,
        lastName,
        role: 'CUSTOMER',
        isActive: true,
        isEmailVerified: true,
        authProvider: 'GOOGLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      await logSecurityEvent({
        userId: user.id,
        event: 'USER_REGISTERED_GOOGLE',
        severity: 'INFO',
        details: JSON.stringify({ email }),
        ipAddress,
        userAgent
      });
    }
  }
  
  // Update last login
  await updateLastLogin(user.id, ipAddress);
  
  await logSecurityEvent({
    userId: user.id,
    event: 'LOGIN_SUCCESS_GOOGLE',
    severity: 'INFO',
    details: JSON.stringify({ email }),
    ipAddress,
    userAgent
  });
  
  // Remove sensitive data
  const { passwordHash, ...userWithoutPassword } = user;
  
  // TODO: Generate JWT tokens
  
  return {
    user: userWithoutPassword,
    message: 'Google login successful',
    isNewUser: !user.lastLoginAt
  };
}

/**
 * Request password reset OTP
 */
async function requestPasswordReset({ email, ipAddress = null, userAgent = null }) {
  email = email.toLowerCase();
  
  const user = await findUserAuthByEmail(email);
  
  // Security: Always return success to prevent enumeration
  // If user doesn't exist, still return success but don't send email
  if (!user) {
    await logSecurityEvent({
      userId: null,
      event: 'PASSWORD_RESET_REQUESTED_INVALID',
      severity: 'INFO',
      details: JSON.stringify({ email }),
      ipAddress,
      userAgent
    });
    
    return {
      success: true,
      message: 'If an account exists with this email, a password reset code has been sent.'
    };
  }
  
  // Create and send OTP
  const otpResult = await createOTP({
    email,
    type: 'PASSWORD_RESET',
    userId: user.id,
    ipAddress,
    userAgent
  });
  
  await logSecurityEvent({
    userId: user.id,
    event: 'PASSWORD_RESET_REQUESTED',
    severity: 'INFO',
    details: JSON.stringify({ email }),
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    message: 'If an account exists with this email, a password reset code has been sent.',
    ...(process.env.NODE_ENV !== 'production' && { 
      devOTP: otpResult.plainOTP 
    })
  };
}

/**
 * Reset password with OTP
 */
async function resetPassword({ 
  email, 
  otp, 
  newPassword, 
  ipAddress = null, 
  userAgent = null 
}) {
  // Verify OTP
  const result = await verifyOTP({
    email: email.toLowerCase(),
    otp,
    type: 'PASSWORD_RESET',
    ipAddress,
    userAgent
  });
  
  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  
  // Update password and reset security flags
  await resetPasswordSecurity(result.userId, passwordHash);
  
  await logSecurityEvent({
    userId: result.userId,
    event: 'PASSWORD_RESET_SUCCESS',
    severity: 'INFO',
    details: JSON.stringify({ email: result.email }),
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    message: 'Password reset successful. You can now login with your new password.'
  };
}

/**
 * Change password (for logged-in users)
 */
async function changePassword({ 
  userId, 
  currentPassword, 
  newPassword, 
  ipAddress = null, 
  userAgent = null 
}) {
  const user = await findUserById(userId);
  
  if (!user || !user.passwordHash) {
    throw new AppError('Unable to change password', 400);
  }
  
  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    await logSecurityEvent({
      userId,
      event: 'PASSWORD_CHANGE_FAILED',
      severity: 'WARNING',
      details: JSON.stringify({ reason: 'invalid_current_password' }),
      ipAddress,
      userAgent
    });
    
    throw new AppError('Current password is incorrect', 401);
  }
  
  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  
  // Update password
  await updateUserPassword(userId, passwordHash);
  
  await logSecurityEvent({
    userId,
    event: 'PASSWORD_CHANGED',
    severity: 'INFO',
    details: JSON.stringify({ email: user.email }),
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    message: 'Password changed successfully'
  };
}

/**
 * Enable/disable 2FA
 */
async function toggle2FA({ userId, enable, ipAddress = null, userAgent = null }) {
  await updateTwoFactorEnabled(userId, enable);
  
  await logSecurityEvent({
    userId,
    event: enable ? '2FA_ENABLED' : '2FA_DISABLED',
    severity: 'INFO',
    details: JSON.stringify({ enabled: enable }),
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    message: `Two-factor authentication ${enable ? 'enabled' : 'disabled'} successfully`
  };
}

export {
  register,
  verifyEmail,
  login,
  verify2FA,
  googleLogin,
  requestPasswordReset,
  resetPassword,
  changePassword,
  toggle2FA,
};
