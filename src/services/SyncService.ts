import { executeQuery } from '../db/config';
import { YNABService } from './YNABService';
import logger from '../utils/logger';
import { SyncItem, SyncResult } from '../types/ynab';

export class SyncService {
  private ynabService: YNABService;

  constructor() {
    this.ynabService = new YNABService();
  }

  // Initialize sync service
  async initialize(): Promise<void> {
    await this.ynabService.loadServerKnowledge();
  }

  // Get current sync status
  async getCurrentStatus(): Promise<any> {
    const result = await executeQuery<any[]>(
      'SELECT * FROM sync_history ORDER BY started_at DESC LIMIT 1'
    );
    return result[0] || { status: 'idle' };
  }

  // Get pending sync items
  async getPendingItems(): Promise<SyncItem[]> {
    return executeQuery<SyncItem[]>(
      'SELECT * FROM pending_items WHERE status = $1 ORDER BY created_at ASC',
      ['pending']
    );
  }

  // Start a new sync
  async startSync(budgetId: string): Promise<void> {
    const syncId = await this.createSyncHistory('in_progress');
    
    try {
      // Get transactions from YNAB
      const transactions = await this.ynabService.getTransactions(budgetId);
      
      // Create pending items for each transaction
      for (const transaction of transactions) {
        await this.createPendingItem(syncId, {
          item_type: 'transaction',
          action: 'create',
          data: transaction
        });
      }
      
      // Process pending items
      const result = await this.processPendingItems(syncId);
      
      // Update sync history
      await this.updateSyncHistory(syncId, {
        status: result.success ? 'completed' : 'failed',
        items_processed: result.items_processed,
        items_failed: result.items_failed,
        error_message: result.error_message
      });
    } catch (error) {
      logger.error('Sync failed:', error);
      await this.updateSyncHistory(syncId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Create sync history entry
  private async createSyncHistory(status: string): Promise<number> {
    const result = await executeQuery<any[]>(
      'INSERT INTO sync_history (status, started_at) VALUES ($1, NOW()) RETURNING id',
      [status]
    );
    return result[0].id;
  }

  // Update sync history
  private async updateSyncHistory(
    syncId: number,
    update: {
      status: string;
      items_processed?: number;
      items_failed?: number;
      error_message?: string;
    }
  ): Promise<void> {
    const { status, items_processed, items_failed, error_message } = update;
    await executeQuery(
      `UPDATE sync_history 
       SET status = $1,
           items_processed = COALESCE($2, items_processed),
           items_failed = COALESCE($3, items_failed),
           error_message = $4,
           completed_at = NOW()
       WHERE id = $5`,
      [status, items_processed, items_failed, error_message, syncId]
    );
  }

  // Create pending item
  private async createPendingItem(
    syncId: number,
    item: Partial<SyncItem>
  ): Promise<void> {
    await executeQuery(
      `INSERT INTO pending_items 
       (sync_id, item_type, action, item_data, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [syncId, item.item_type, item.action, item.data, 'pending']
    );
  }

  // Process pending items
  private async processPendingItems(syncId: number): Promise<SyncResult> {
    const items = await executeQuery<SyncItem[]>(
      'SELECT * FROM pending_items WHERE sync_id = $1 AND status = $2',
      [syncId, 'pending']
    );

    let processed = 0;
    let failed = 0;
    let lastError: string | undefined;

    for (const item of items) {
      try {
        switch (item.item_type) {
          case 'transaction':
            await this.processTransactionItem(item);
            break;
          // Add other item types here
          default:
            throw new Error(`Unknown item type: ${item.item_type}`);
        }
        
        await this.updatePendingItem(item.id, 'completed');
        processed++;
      } catch (error) {
        logger.error('Failed to process item:', error);
        await this.updatePendingItem(
          item.id,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
        failed++;
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return {
      success: failed === 0,
      items_processed: processed,
      items_failed: failed,
      error_message: lastError
    };
  }

  // Process a transaction item
  private async processTransactionItem(item: SyncItem): Promise<void> {
    const budgetId = item.data.budget_id;
    
    switch (item.action) {
      case 'create':
        await this.ynabService.createTransaction(budgetId, item.data);
        break;
      case 'update':
        await this.ynabService.updateTransaction(budgetId, item.data.id, item.data);
        break;
      case 'delete':
        await this.ynabService.deleteTransaction(budgetId, item.data.id);
        break;
      default:
        throw new Error(`Unknown action: ${item.action}`);
    }
  }

  // Update pending item status
  private async updatePendingItem(
    itemId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    await executeQuery(
      `UPDATE pending_items 
       SET status = $1,
           error_message = $2,
           retry_count = retry_count + 1
       WHERE id = $3`,
      [status, errorMessage, itemId]
    );
  }

  // Get recent sync history
  async getRecentHistory(limit: number = 10): Promise<any[]> {
    return executeQuery(
      'SELECT * FROM sync_history ORDER BY started_at DESC LIMIT $1',
      [limit]
    );
  }

  // Retry failed items
  async retryFailedItems(): Promise<number> {
    const result = await executeQuery<{count: string}[]>(
      `UPDATE pending_items 
       SET status = 'pending',
           retry_count = retry_count + 1
       WHERE status = 'failed'
       AND retry_count < 3
       RETURNING COUNT(*)`,
      []
    );
    return parseInt(result[0].count);
  }

  // Clean up old sync history
  async cleanupOldHistory(daysToKeep: number = 30): Promise<void> {
    try {
      await executeQuery(
        `DELETE FROM sync_history 
         WHERE completed_at < NOW() - INTERVAL '${daysToKeep} days'
         AND status IN ('completed', 'failed')`
      );
      logger.info(`Cleaned up sync history older than ${daysToKeep} days`);
    } catch (error) {
      logger.error('Failed to clean up sync history:', error);
      throw error;
    }
  }

  // Clean up old pending items
  async cleanupOldPendingItems(daysToKeep: number = 7): Promise<void> {
    try {
      await executeQuery(
        `DELETE FROM pending_items 
         WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
         AND status IN ('completed', 'failed')
         AND sync_id IN (
           SELECT id FROM sync_history 
           WHERE status IN ('completed', 'failed')
         )`
      );
      logger.info(`Cleaned up pending items older than ${daysToKeep} days`);
    } catch (error) {
      logger.error('Failed to clean up pending items:', error);
      throw error;
    }
  }

  // Schedule cleanup jobs
  scheduleCleanupJobs(): void {
    // Run cleanup every day at midnight
    setInterval(() => {
      this.cleanupOldHistory()
        .catch(error => logger.error('Scheduled sync history cleanup failed:', error));
      this.cleanupOldPendingItems()
        .catch(error => logger.error('Scheduled pending items cleanup failed:', error));
    }, 24 * 60 * 60 * 1000);

    logger.info('Scheduled cleanup jobs');
  }
} 