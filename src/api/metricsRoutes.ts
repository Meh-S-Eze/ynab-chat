import { Router } from 'express';
import metrics from '../utils/metrics';
import pool from '../db/config';
import logger from '../utils/logger';

const router = Router();

router.get('/metrics', async (req, res) => {
  try {
    // Get current metrics
    const currentMetrics = metrics.getAllMetrics();

    // Get database pool metrics
    const poolMetrics = await pool.query(
      `SELECT state, count(*) 
       FROM pg_stat_activity 
       WHERE application_name LIKE '%ynab-sync%'
       GROUP BY state`
    );

    // Get sync status metrics
    const syncMetrics = await pool.query(
      `SELECT status, count(*) 
       FROM sync_history 
       WHERE started_at > NOW() - INTERVAL '24 hours'
       GROUP BY status`
    );

    // Get error rate metrics
    const errorMetrics = await pool.query(
      `SELECT date_trunc('hour', started_at) as hour,
              COUNT(*) FILTER (WHERE status = 'failed') as failures,
              COUNT(*) as total
       FROM sync_history
       WHERE started_at > NOW() - INTERVAL '24 hours'
       GROUP BY hour
       ORDER BY hour DESC`
    );

    res.json({
      timestamp: new Date().toISOString(),
      metrics: currentMetrics,
      database: {
        pool: poolMetrics.rows,
        sync_status: syncMetrics.rows,
        error_rate: errorMetrics.rows
      }
    });
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Reset metrics endpoint (protected, only for development)
if (process.env.NODE_ENV === 'development') {
  router.post('/metrics/reset', (req, res) => {
    metrics.resetAll();
    res.json({ message: 'Metrics reset successfully' });
  });
}

export default router; 