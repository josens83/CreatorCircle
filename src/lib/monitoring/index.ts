/**
 * Monitoring Module
 * Centralized exports for logging, metrics, error tracking, and health checks
 */

// =============================================================================
// Logging
// =============================================================================

export {
  Logger,
  PerformanceLogger,
  AuditLogger,
  logger,
  auditLogger,
  createRequestLogger,
  type LogLevel,
  type LogContext,
  type LogEntry,
  type AuditAction,
  type AuditLogEntry,
} from './logger';

// =============================================================================
// Error Tracking (Sentry)
// =============================================================================

export {
  SentryClient,
  SentryTransaction,
  SentrySpan,
  sentry,
  captureReactError,
  captureApiError,
  type SeverityLevel,
  type SentryUser,
  type SentryContext,
  type SentryTag,
  type SentryBreadcrumb,
  type SentryEvent,
  type SentryConfig,
} from './sentry';

// =============================================================================
// Metrics (Prometheus)
// =============================================================================

export {
  Counter,
  Gauge,
  Histogram,
  registry,
  getMetrics,
  getMetricsContentType,
  createHttpMetricsMiddleware,
  SystemMetricsCollector,
  systemMetrics,
  // Pre-defined metrics
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
  type MetricType,
  type MetricLabels,
  type MetricConfig,
  type HistogramConfig,
} from './metrics';

// =============================================================================
// Health Checks
// =============================================================================

export {
  healthChecker,
  createDatabaseHealthCheck,
  createRedisHealthCheck,
  createStripeHealthCheck,
  createMemoryHealthCheck,
  createDiskHealthCheck,
  createExternalApiHealthCheck,
  createCircuitBreakerHealthCheck,
  createDependencyHealthCheck,
  type HealthStatus,
  type ComponentHealth,
  type HealthCheckResult,
  type HealthCheckConfig,
  type DependencyNode,
} from './health';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Initialize all monitoring systems
 * Call this at application startup
 */
export function initializeMonitoring(): void {
  const { logger } = require('./logger');
  const { systemMetrics } = require('./metrics');
  const { sentry } = require('./sentry');

  // Start system metrics collection (every 15 seconds)
  if (typeof setInterval !== 'undefined') {
    systemMetrics.startCollecting(15000);
  }

  // Log startup
  logger.info('Monitoring systems initialized', {
    environment: process.env.NODE_ENV,
    version: process.env.NEXT_PUBLIC_VERSION,
  });

  // Set Sentry environment
  sentry.setTags({
    environment: process.env.NODE_ENV || 'development',
    version: process.env.NEXT_PUBLIC_VERSION || 'unknown',
  });
}

/**
 * Create a monitoring context for a request
 * Use this in API routes to track the full request lifecycle
 */
export function createRequestContext(request: Request) {
  const { createRequestLogger, PerformanceLogger } = require('./logger');
  const { sentry } = require('./sentry');
  const { httpActiveRequests } = require('./metrics');

  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // Create logger with request context
  const requestLogger = createRequestLogger({
    method,
    url: path,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || undefined,
  });

  // Create performance logger
  const perfLogger = new PerformanceLogger(requestLogger);

  // Increment active requests
  httpActiveRequests.inc({ method });

  // Start Sentry transaction
  const transaction = sentry.startTransaction(`${method} ${path}`, 'http.server');

  return {
    logger: requestLogger,
    perf: perfLogger,
    transaction,
    startTime: Date.now(),
    method,
    path,

    // Call this when the request completes
    finish: (status: number) => {
      httpActiveRequests.dec({ method });
      transaction.setStatus(status >= 400 ? 'error' : 'ok');
      transaction.finish();
    },
  };
}

/**
 * Error wrapper for API routes
 * Automatically logs errors and sends to Sentry
 */
export function captureError(
  error: Error,
  context?: {
    userId?: string;
    requestId?: string;
    path?: string;
    method?: string;
  }
): string {
  const { logger } = require('./logger');
  const { sentry } = require('./sentry');
  const { errorsTotal } = require('./metrics');

  // Log error
  logger.error(error.message, error, context);

  // Increment error metric
  errorsTotal.inc({
    type: error.name,
    code: (error as Error & { code?: string }).code || 'UNKNOWN',
  });

  // Send to Sentry
  if (context?.userId) {
    sentry.setUser({ id: context.userId });
  }

  return sentry.captureException(error, {
    tags: {
      path: context?.path || 'unknown',
      method: context?.method || 'unknown',
    },
  });
}
