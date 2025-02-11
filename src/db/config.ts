import { Pool, PoolConfig } from 'pg';
import logger from '../utils/logger';
import { backOff } from 'exponential-backoff';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ynab_sync',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT
  } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  logger.info('New client connected to database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Wrapper for database queries with retry logic
export async function executeQuery<T>(
  query: string,
  params: any[] = [],
  maxAttempts = 3
): Promise<T> {
  const execute = async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows as T;
    } finally {
      client.release();
    }
  };

  try {
    return await backOff(() => execute(), {
      numOfAttempts: maxAttempts,
      startingDelay: 1000,
      timeMultiple: 2,
      retry: (e: any) => {
        logger.warn('Database query failed, retrying...', e);
        return true;
      },
    });
  } catch (error) {
    logger.error('Database query failed after retries', { query, error });
    throw error;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', error);
    return false;
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool', error);
    throw error;
  }
}

// Function to test the database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
};

export default pool; 