import { Router } from 'express';
import { testConnection } from '../db/config';
import logger from '../utils/logger';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    const health = {
      status: dbStatus ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus ? 'connected' : 'disconnected'
      }
    };

    logger.info('Health check performed', health);
    
    res.status(dbStatus ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'error'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 