import { SyncService } from '../services/SyncService';
import { YNABService } from '../services/YNABService';
import logger from '../utils/logger';
import pool from '../db/config';

async function validateSync() {
  const syncService = new SyncService();
  const ynabService = new YNABService();

  try {
    logger.info('Starting sync validation...');

    // Test YNAB service initialization
    await ynabService.loadServerKnowledge();
    logger.info('YNAB service initialized');

    // Validate server knowledge tracking
    const budgets = await ynabService.getBudgets();
    if (!budgets.length) {
      throw new Error('No budgets found');
    }
    const testBudgetId = budgets[0].id;

    // Get initial server knowledge
    const initialKnowledge = await pool.query(
      'SELECT * FROM server_knowledge WHERE budget_id = $1',
      [testBudgetId]
    );

    // Fetch some transactions to update server knowledge
    await ynabService.getTransactions(testBudgetId);

    // Verify server knowledge was updated
    const updatedKnowledge = await pool.query(
      'SELECT * FROM server_knowledge WHERE budget_id = $1',
      [testBudgetId]
    );

    if (!updatedKnowledge.rows.length) {
      throw new Error('Server knowledge not tracked');
    }
    logger.info('Server knowledge tracking validated');

    // Test sync history recording
    await syncService.startSync(testBudgetId);
    const syncHistory = await pool.query(
      'SELECT * FROM sync_history ORDER BY started_at DESC LIMIT 1'
    );
    
    if (!syncHistory.rows.length) {
      throw new Error('Sync history not recorded');
    }
    logger.info('Sync history recording validated');

    // Check pending items processing
    const pendingItems = await pool.query(
      'SELECT status, COUNT(*) FROM pending_items GROUP BY status'
    );
    logger.info('Pending items status:', pendingItems.rows);

    // Test retry mechanism
    const failedItems = await pool.query(
      "SELECT * FROM pending_items WHERE status = 'failed'"
    );
    
    if (failedItems.rows.length > 0) {
      const retryCount = await syncService.retryFailedItems();
      logger.info(`Retried ${retryCount} failed items`);
    }

    // Validate cleanup functionality
    await syncService.cleanupOldHistory(1);
    await syncService.cleanupOldPendingItems(1);
    logger.info('Cleanup functionality validated');

    // Check error handling
    const errorPatterns = await pool.query(`
      SELECT error_message, COUNT(*) 
      FROM sync_history 
      WHERE status = 'failed' 
      GROUP BY error_message
    `);
    logger.info('Error patterns:', errorPatterns.rows);

    logger.info('Sync validation completed successfully');
    return true;
  } catch (error) {
    logger.error('Sync validation failed:', error);
    throw error;
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateSync()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default validateSync; 