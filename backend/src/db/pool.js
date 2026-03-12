// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MYSQL CONNECTION POOL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import mysql from 'mysql2/promise';
import config from '../config/index.js';
import logger from '../config/logger.js';

const pool = mysql.createPool({
  uri: config.database.url,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: false,
});

export const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

export const getConnection = async () => pool.getConnection();

export const testConnection = async () => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return rows?.[0]?.ok === 1;
  } catch (error) {
    logger.error('Database connection test failed', {
      message: error.message,
      code: error.code,
    });
    throw error;
  }
};

export const closePool = async () => {
  await pool.end();
};

export default pool;
