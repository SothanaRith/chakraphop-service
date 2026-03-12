// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE ACCESS LAYER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import pool, { query, getConnection, testConnection, closePool } from './pool.js';

export const execute = async (sql, params = [], connection = null) => {
	const executor = connection || pool;
	const [rows] = await executor.query(sql, params);
	return rows;
};

export const executeOne = async (sql, params = [], connection = null) => {
	const rows = await execute(sql, params, connection);
	return rows[0] || null;
};

export const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

export { query, getConnection, testConnection, closePool };
export { withTransaction, withTransactionRetry } from './transaction.js';
