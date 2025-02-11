import { Router } from 'express';
import { SyncService } from '../services/SyncService';
import { logger } from '../utils/logger';

const router = Router();
const syncService = new SyncService();

// Get current sync status
router.get('/status', async (req, res) => {
  try {
    const status = await syncService.getCurrentStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Get pending sync items
router.get('/pending', async (req, res) => {
  try {
    const items = await syncService.getPendingItems();
    res.json(items);
  } catch (error) {
    logger.error('Error getting pending items:', error);
    res.status(500).json({ error: 'Failed to get pending items' });
  }
});

// Get recent sync history
router.get('/history', async (req, res) => {
  try {
    const history = await syncService.getRecentHistory();
    res.json(history);
  } catch (error) {
    logger.error('Error getting sync history:', error);
    res.status(500).json({ error: 'Failed to get sync history' });
  }
});

// Trigger sync
router.post('/trigger', async (req, res) => {
  try {
    await syncService.updateStatus('in_progress');
    // Here you would trigger your actual sync process
    // For now, we'll just update the status
    res.json({ message: 'Sync triggered successfully' });
  } catch (error) {
    logger.error('Error triggering sync:', error);
    await syncService.updateStatus('failed', error.message);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// Retry failed items
router.post('/retry', async (req, res) => {
  try {
    const retryCount = await syncService.retryFailedItems();
    if (retryCount > 0) {
      await syncService.updateStatus('in_progress');
      res.json({ message: `Retrying ${retryCount} failed items` });
    } else {
      res.json({ message: 'No failed items to retry' });
    }
  } catch (error) {
    logger.error('Error retrying failed items:', error);
    res.status(500).json({ error: 'Failed to retry items' });
  }
});

export default router; 