// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GLOBAL ERROR HANDLING MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Catches all errors and returns consistent API responses
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import config from '../config/index.js';

export const errorHandler = (err, req, res, next) => {
  // Prevent sending headers if response already started
  if (res.headersSent) {
    logger.error('Response already sent, cannot handle error', {
      message: err.message,
      url: req.originalUrl
    });
    return;
  }

  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error
  logger.error('Error caught by global handler', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    error = new AppError('Duplicate entry. Resource already exists.', 409);
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    error = new AppError('Related resource not found', 404);
  }

  if (err.code === 'ER_BAD_NULL_ERROR' || err.code === 'ER_TRUNCATED_WRONG_VALUE') {
    error = new AppError('Invalid data provided', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  // Validation errors (express-validator)
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    error = new AppError('Validation failed', 400, errors);
  }

  // Operational errors (our custom errors)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(err.errors && { errors: err.errors })
    });
  }

  // Programming or unknown errors
  if (!config.isProduction) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
      stack: error.stack,
      error: err
    });
  }

  // Production: Don't leak error details
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong. Please try again later.'
  });
};

// Handle 404 - Route not found
export const notFound = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404
  );
  next(error);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise
  });
  // In production, you might want to gracefully shut down
  // process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception - Server will terminate', {
    message: error.message,
    stack: error.stack,
    type: error.constructor.name
  });
  
  // Gracefully shut down
  if (config.isProduction) {
    process.exit(1); // Force restart in production
  } else {
    process.exit(1); // Force restart in all environments
  }
});
