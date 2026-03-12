// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Protects routes and injects authenticated user into request
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { verifyAccessToken } from '../utils/jwt.js';
import { AuthenticationError } from '../utils/errors.js';
import logger from '../config/logger.js';
import { findUserById } from '../repositories/user.repository.js';

/**
 * Verify JWT token and attach user to request
 * Usage: Apply to routes that require authentication
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    // Fetch full user from database (includes latest role/status)
    const user = await findUserById(decoded.id);

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Attach user to request object
    req.user = user;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthenticationError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Optional authentication - doesn't throw error if no token
 * Useful for endpoints that work differently for authenticated users
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    // Separate JWT errors (acceptable for optional auth) from other errors
    try {
      const decoded = verifyAccessToken(token);

      const user = await findUserById(decoded.id);

      if (user && user.isActive) {
        req.user = user;
      }
      
      return next();
    } catch (tokenError) {
      // Only JWT errors are acceptable for optional auth
      if (tokenError.name === 'JsonWebTokenError' || 
          tokenError.name === 'TokenExpiredError') {
        return next(); // Silent fail only for invalid tokens
      }
      throw tokenError; // Re-throw other errors (DB, etc.)
    }
  } catch (error) {
    logger.warn('Error in optional authentication', {
      message: error.message,
      stack: error.stack,
      ip: req.ip
    });
    next(); // Continue request (optional auth failed)
  }
};
