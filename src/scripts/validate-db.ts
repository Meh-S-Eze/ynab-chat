import { Pool } from 'pg';
import logger from '../utils/logger';
import { testConnection } from '../db/config';

async function validateDatabase() {
  const pool = new Pool();
  
  try {
    logger.info('Starting database validation...');

    // Test basic connectivity
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection test failed');
    }
    logger.info('Database connection test passed');

    // Check table structure
    const tables = ['sync_history', 'pending_items', 'server_knowledge'];
    for (const table of tables) {
      const result = await pool.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = $1
         )`,
        [table]
      );
      if (!result.rows[0].exists) {
        throw new Error(`Table ${table} does not exist`);
      }
      logger.info(`Table ${table} exists`);
    }

    // Validate indexes
    const indexQueries = [
      `SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'sync_history' AND indexname = 'sync_history_status_index'`,
      `SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'pending_items' AND indexname = 'pending_items_status_index'`,
      `SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'server_knowledge' AND indexname = 'server_knowledge_last_sync_time_index'`
    ];

    for (const query of indexQueries) {
      const result = await pool.query(query);
      logger.info(`Index query result:`, { query, count: result.rows[0].count });
      if (result.rows[0].count === '0') {
        throw new Error('Missing required index');
      }
    }
    logger.info('All required indexes are present');

    // Test trigger functionality
    const testTrigger = async (table: string) => {
      try {
        let result;
        if (table === 'sync_history') {
          result = await pool.query(
            `INSERT INTO ${table} (status, started_at) 
             VALUES ('pending', NOW()) 
             RETURNING updated_at`
          );
        } else if (table === 'pending_items') {
          result = await pool.query(
            `INSERT INTO ${table} (item_type, item_data, status) 
             VALUES ('transaction', '{}', 'pending') 
             RETURNING updated_at`
          );
        } else if (table === 'server_knowledge') {
          result = await pool.query(
            `INSERT INTO ${table} (budget_id, transaction_knowledge, category_knowledge) 
             VALUES ('test-budget', 0, 0) 
             RETURNING updated_at`
          );
        }
        
        const insertTime = result.rows[0].updated_at;
        logger.info(`Inserted test record in ${table}`, { insertTime });
        
        if (table === 'sync_history' || table === 'pending_items') {
          await pool.query(
            `UPDATE ${table} SET status = 'completed' WHERE updated_at = $1`,
            [insertTime]
          );
        } else if (table === 'server_knowledge') {
          await pool.query(
            `UPDATE ${table} SET transaction_knowledge = 1 WHERE updated_at = $1`,
            [insertTime]
          );
        }
        logger.info(`Updated test record in ${table}`);
        
        const updated = await pool.query(
          `SELECT updated_at FROM ${table} WHERE updated_at > $1 LIMIT 1`,
          [insertTime]
        );
        
        if (!updated.rows.length) {
          throw new Error(`Trigger on ${table} is not updating updated_at`);
        }
        logger.info(`Trigger test passed for ${table}`);
      } catch (error) {
        logger.error(`Trigger test failed for ${table}:`, error);
        throw error;
      }
    };

    // Test triggers on all tables
    await testTrigger('sync_history');
    await testTrigger('pending_items');
    await testTrigger('server_knowledge');
    logger.info('Trigger functionality validated');

    // Check connection pool health
    const poolStatus = await pool.query(
      "SELECT state, count(*) FROM pg_stat_activity GROUP BY state"
    );
    logger.info('Connection pool status:', poolStatus.rows);

    logger.info('Database validation completed successfully');
    return true;
  } catch (error) {
    logger.error('Database validation failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default validateDatabase; 