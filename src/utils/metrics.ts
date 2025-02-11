import logger from './logger';

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  lastUpdate: Date;
}

class Metrics {
  private metrics: Map<string, MetricValue> = new Map();
  private counters: Map<string, number> = new Map();

  // Record a metric value
  record(name: string, value: number) {
    const current = this.metrics.get(name) || {
      count: 0,
      sum: 0,
      min: value,
      max: value,
      lastUpdate: new Date()
    };

    current.count++;
    current.sum += value;
    current.min = Math.min(current.min, value);
    current.max = Math.max(current.max, value);
    current.lastUpdate = new Date();

    this.metrics.set(name, current);
    logger.debug(`Recorded metric ${name}: ${value}`);
  }

  // Increment a counter
  increment(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    logger.debug(`Incremented counter ${name} by ${value}`);
  }

  // Get metric statistics
  getMetric(name: string): Partial<MetricValue> & { average?: number } | undefined {
    const metric = this.metrics.get(name);
    if (!metric) return undefined;

    return {
      ...metric,
      average: metric.sum / metric.count
    };
  }

  // Get counter value
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  // Get all metrics
  getAllMetrics() {
    const result: Record<string, any> = {};
    
    // Add metrics
    this.metrics.forEach((value, key) => {
      result[key] = {
        ...value,
        average: value.sum / value.count
      };
    });

    // Add counters
    this.counters.forEach((value, key) => {
      result[key] = { count: value };
    });

    return result;
  }

  // Reset a specific metric
  resetMetric(name: string) {
    this.metrics.delete(name);
    this.counters.delete(name);
  }

  // Reset all metrics
  resetAll() {
    this.metrics.clear();
    this.counters.clear();
  }
}

// Create a singleton instance
const metrics = new Metrics();

// Predefined metric names
export const MetricNames = {
  // Sync metrics
  SYNC_DURATION: 'sync.duration',
  SYNC_ITEMS_PROCESSED: 'sync.items_processed',
  SYNC_ITEMS_FAILED: 'sync.items_failed',
  SYNC_RETRIES: 'sync.retries',

  // API metrics
  API_REQUESTS: 'api.requests',
  API_ERRORS: 'api.errors',
  API_LATENCY: 'api.latency',

  // Database metrics
  DB_QUERIES: 'db.queries',
  DB_ERRORS: 'db.errors',
  DB_LATENCY: 'db.latency',
  DB_POOL_SIZE: 'db.pool_size',
  DB_ACTIVE_CONNECTIONS: 'db.active_connections'
};

export default metrics; 