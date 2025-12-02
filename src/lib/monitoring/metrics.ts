/**
 * Prometheus Metrics Implementation
 * Netflix/Spotify-grade metrics collection
 */

// =============================================================================
// Types
// =============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricLabels {
  [key: string]: string;
}

export interface MetricConfig {
  name: string;
  help: string;
  labelNames?: string[];
}

export interface HistogramConfig extends MetricConfig {
  buckets?: number[];
}

// =============================================================================
// Default Histogram Buckets
// =============================================================================

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const HTTP_LATENCY_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30];

const DB_LATENCY_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2];

// =============================================================================
// Counter
// =============================================================================

export class Counter {
  private name: string;
  private help: string;
  private labelNames: string[];
  private values: Map<string, number> = new Map();

  constructor(config: MetricConfig) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames || [];
  }

  inc(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  private labelsToKey(labels: MetricLabels): string {
    if (this.labelNames.length === 0) return '';
    return this.labelNames.map((name) => labels[name] || '').join(',');
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} counter\n`;

    if (this.values.size === 0) {
      output += `${this.name} 0\n`;
    } else {
      for (const [key, value] of this.values) {
        if (key) {
          const labelPairs = this.labelNames
            .map((name, i) => `${name}="${key.split(',')[i]}"`)
            .join(',');
          output += `${this.name}{${labelPairs}} ${value}\n`;
        } else {
          output += `${this.name} ${value}\n`;
        }
      }
    }

    return output;
  }
}

// =============================================================================
// Gauge
// =============================================================================

export class Gauge {
  private name: string;
  private help: string;
  private labelNames: string[];
  private values: Map<string, number> = new Map();

  constructor(config: MetricConfig) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames || [];
  }

  set(value: number, labels: MetricLabels = {}): void {
    const key = this.labelsToKey(labels);
    this.values.set(key, value);
  }

  inc(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  dec(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current - value);
  }

  private labelsToKey(labels: MetricLabels): string {
    if (this.labelNames.length === 0) return '';
    return this.labelNames.map((name) => labels[name] || '').join(',');
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} gauge\n`;

    if (this.values.size === 0) {
      output += `${this.name} 0\n`;
    } else {
      for (const [key, value] of this.values) {
        if (key) {
          const labelPairs = this.labelNames
            .map((name, i) => `${name}="${key.split(',')[i]}"`)
            .join(',');
          output += `${this.name}{${labelPairs}} ${value}\n`;
        } else {
          output += `${this.name} ${value}\n`;
        }
      }
    }

    return output;
  }
}

// =============================================================================
// Histogram
// =============================================================================

export class Histogram {
  private name: string;
  private help: string;
  private labelNames: string[];
  private buckets: number[];
  private values: Map<
    string,
    { buckets: Map<number, number>; sum: number; count: number }
  > = new Map();

  constructor(config: HistogramConfig) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames || [];
    this.buckets = [...(config.buckets || DEFAULT_BUCKETS), Infinity].sort(
      (a, b) => a - b
    );
  }

  observe(value: number, labels: MetricLabels = {}): void {
    const key = this.labelsToKey(labels);
    let data = this.values.get(key);

    if (!data) {
      data = {
        buckets: new Map(this.buckets.map((b) => [b, 0])),
        sum: 0,
        count: 0,
      };
      this.values.set(key, data);
    }

    data.sum += value;
    data.count += 1;

    for (const bucket of this.buckets) {
      if (value <= bucket) {
        data.buckets.set(bucket, (data.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  startTimer(labels: MetricLabels = {}): () => void {
    const startTime = performance.now();
    return () => {
      const duration = (performance.now() - startTime) / 1000; // Convert to seconds
      this.observe(duration, labels);
    };
  }

  private labelsToKey(labels: MetricLabels): string {
    if (this.labelNames.length === 0) return '';
    return this.labelNames.map((name) => labels[name] || '').join(',');
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} histogram\n`;

    for (const [key, data] of this.values) {
      const labelPrefix = key
        ? this.labelNames
            .map((name, i) => `${name}="${key.split(',')[i]}"`)
            .join(',') + ','
        : '';

      let cumulative = 0;
      for (const bucket of this.buckets) {
        cumulative += data.buckets.get(bucket) || 0;
        const le = bucket === Infinity ? '+Inf' : bucket.toString();
        output += `${this.name}_bucket{${labelPrefix}le="${le}"} ${cumulative}\n`;
      }

      output += `${this.name}_sum{${labelPrefix.slice(0, -1)}} ${data.sum}\n`;
      output += `${this.name}_count{${labelPrefix.slice(0, -1)}} ${data.count}\n`;
    }

    return output;
  }
}

// =============================================================================
// Metrics Registry
// =============================================================================

class MetricsRegistry {
  private metrics: Map<string, Counter | Gauge | Histogram> = new Map();
  private static instance: MetricsRegistry;

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  register(metric: Counter | Gauge | Histogram): void {
    const name = (metric as { name?: string }).name || 'unknown';
    this.metrics.set(name, metric);
  }

  collect(): string {
    let output = '';
    for (const metric of this.metrics.values()) {
      output += metric.collect();
      output += '\n';
    }
    return output;
  }

  clear(): void {
    this.metrics.clear();
  }
}

// =============================================================================
// Pre-defined Metrics
// =============================================================================

export const registry = MetricsRegistry.getInstance();

// HTTP Metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: HTTP_LATENCY_BUCKETS,
});

export const httpActiveRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  labelNames: ['method'],
});

// Database Metrics
export const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: DB_LATENCY_BUCKETS,
});

export const dbConnectionPoolSize = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Database connection pool size',
  labelNames: ['state'],
});

// Business Metrics
export const usersTotal = new Gauge({
  name: 'users_total',
  help: 'Total number of users',
  labelNames: ['status'],
});

export const circlesTotal = new Gauge({
  name: 'circles_total',
  help: 'Total number of circles',
  labelNames: ['status'],
});

export const membershipsTotal = new Gauge({
  name: 'memberships_total',
  help: 'Total number of memberships',
  labelNames: ['tier', 'status'],
});

export const subscriptionsTotal = new Gauge({
  name: 'subscriptions_total',
  help: 'Total number of subscriptions',
  labelNames: ['status'],
});

export const paymentsTotal = new Counter({
  name: 'payments_total',
  help: 'Total number of payments processed',
  labelNames: ['type', 'status'],
});

export const revenueTotal = new Counter({
  name: 'revenue_total_krw',
  help: 'Total revenue in KRW',
  labelNames: ['type'],
});

export const platformFeeTotal = new Counter({
  name: 'platform_fee_total_krw',
  help: 'Total platform fees collected in KRW',
  labelNames: [],
});

// Error Metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
});

// External Service Metrics
export const externalRequestsTotal = new Counter({
  name: 'external_requests_total',
  help: 'Total number of external service requests',
  labelNames: ['service', 'status'],
});

export const externalRequestDuration = new Histogram({
  name: 'external_request_duration_seconds',
  help: 'External service request duration in seconds',
  labelNames: ['service'],
  buckets: HTTP_LATENCY_BUCKETS,
});

export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['name'],
});

// Rate Limiting Metrics
export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['limiter'],
});

// Register all metrics
[
  httpRequestsTotal,
  httpRequestDuration,
  httpActiveRequests,
  dbQueriesTotal,
  dbQueryDuration,
  dbConnectionPoolSize,
  usersTotal,
  circlesTotal,
  membershipsTotal,
  subscriptionsTotal,
  paymentsTotal,
  revenueTotal,
  platformFeeTotal,
  errorsTotal,
  externalRequestsTotal,
  externalRequestDuration,
  circuitBreakerState,
  rateLimitHits,
].forEach((metric) => registry.register(metric));

// =============================================================================
// Middleware Helper
// =============================================================================

export function createHttpMetricsMiddleware() {
  return {
    onRequest(method: string, path: string): () => void {
      httpActiveRequests.inc({ method });
      const endTimer = httpRequestDuration.startTimer({ method, path });
      const startTime = Date.now();

      return () => {
        // Called when request ends
        // Note: status should be set via recordResponse
        httpActiveRequests.dec({ method });
        endTimer();
      };
    },

    recordResponse(
      method: string,
      path: string,
      status: number,
      startTime: number
    ): void {
      const statusStr = status.toString();
      httpRequestsTotal.inc({ method, path, status: statusStr });

      const duration = (Date.now() - startTime) / 1000;
      httpRequestDuration.observe(duration, { method, path, status: statusStr });
    },
  };
}

// =============================================================================
// Prometheus Exposition Format
// =============================================================================

export function getMetrics(): string {
  return registry.collect();
}

export function getMetricsContentType(): string {
  return 'text/plain; version=0.0.4; charset=utf-8';
}

// =============================================================================
// System Metrics Collector
// =============================================================================

export class SystemMetricsCollector {
  private memoryGauge = new Gauge({
    name: 'nodejs_memory_bytes',
    help: 'Node.js memory usage in bytes',
    labelNames: ['type'],
  });

  private uptimeGauge = new Gauge({
    name: 'nodejs_uptime_seconds',
    help: 'Node.js process uptime in seconds',
  });

  private eventLoopLagHistogram = new Histogram({
    name: 'nodejs_eventloop_lag_seconds',
    help: 'Node.js event loop lag in seconds',
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  });

  constructor() {
    registry.register(this.memoryGauge);
    registry.register(this.uptimeGauge);
    registry.register(this.eventLoopLagHistogram);
  }

  collect(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.memoryGauge.set(memUsage.heapUsed, { type: 'heap_used' });
    this.memoryGauge.set(memUsage.heapTotal, { type: 'heap_total' });
    this.memoryGauge.set(memUsage.external, { type: 'external' });
    this.memoryGauge.set(memUsage.rss, { type: 'rss' });

    // Uptime
    this.uptimeGauge.set(process.uptime());

    // Event loop lag (simplified)
    const start = performance.now();
    setImmediate(() => {
      const lag = (performance.now() - start) / 1000;
      this.eventLoopLagHistogram.observe(lag);
    });
  }

  startCollecting(intervalMs: number = 15000): NodeJS.Timeout {
    this.collect();
    return setInterval(() => this.collect(), intervalMs);
  }
}

// Create singleton
export const systemMetrics = new SystemMetricsCollector();
