// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRANSACTION HELPERS (WITH RETRY FOR DEADLOCKS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { getConnection } from './pool.js';
import logger from '../config/logger.js';

const DEADLOCK_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

const validIsolationLevels = new Set([
  'READ UNCOMMITTED',
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE'
]);

export const withTransaction = async (fn, options = {}) => {
  const { isolationLevel } = options;
  const connection = await getConnection();
  try {
    if (isolationLevel && validIsolationLevels.has(isolationLevel)) {
      await connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    }
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Transaction rollback failed', {
        message: rollbackError.message,
        code: rollbackError.code,
      });
    }
    throw error;
  } finally {
    connection.release();
  }
};

export const withTransactionRetry = async (fn, options = {}) => {
  const { maxRetries = 3, isolationLevel } = options;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await withTransaction(fn, { isolationLevel });
    } catch (error) {
      if (DEADLOCK_CODES.has(error.code) && attempt < maxRetries - 1) {
        attempt += 1;
        const backoff = 100 * attempt;
        logger.warn('Deadlock detected, retrying transaction', {
          attempt,
          maxRetries,
          code: error.code,
        });
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
};
