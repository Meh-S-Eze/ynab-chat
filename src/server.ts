import express from 'express';
import rateLimit from 'express-rate-limit';
import healthcheckRouter from './api/healthcheck';
import syncRouter from './api/syncRoutes';
import metricsRouter from './api/metricsRoutes';
import { validateSchema, schemas } from './middleware/validation';
import metrics, { MetricNames } from './utils/metrics';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Request logging and metrics middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
  }, 'Incoming request');

  // Increment request counter
  metrics.increment(MetricNames.API_REQUESTS);

  // Track response metrics
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.record(MetricNames.API_LATENCY, duration);

    if (res.statusCode >= 400) {
      metrics.increment(MetricNames.API_ERRORS);
    }
  });

  next();
});

// Routes with validation
app.use('/api/health', healthcheckRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/sync', syncRouter);

// Add validation to sync endpoints
app.post('/api/sync/trigger', validateSchema(schemas.sync.trigger));
app.post('/api/sync/retry', validateSchema(schemas.sync.retry));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  metrics.increment(MetricNames.API_ERRORS);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export default app; 