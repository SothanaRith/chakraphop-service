// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVER ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import app from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import { testConnection, closePool } from './config/database.js';

// Test database connection
async function connectDatabase() {
  try {
    await testConnection();
    logger.info('✓ Database connected successfully');
  } catch (error) {
    logger.error('✗ Database connection failed:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  await connectDatabase();

  const server = app.listen(config.server.port, () => {
    logger.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 Sport E-Commerce API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment:  ${config.env}
  Port:         ${config.server.port}
  API Version:  ${config.server.apiVersion}
  URL:          http://localhost:${config.server.port}
  Health:       http://localhost:${config.server.port}/health
  API Docs:     http://localhost:${config.server.port}/api/${config.server.apiVersion}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('✓ HTTP server closed');

      await closePool();
      logger.info('✓ Database disconnected');

      logger.info('✓ Graceful shutdown completed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch(async (error) => {
  logger.error('Failed to start server:', error);
  await closePool();
  process.exit(1);
});
