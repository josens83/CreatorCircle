/**
 * Resilience Module Exports
 *
 * Netflix/Spotify 수준의 복원력 시스템
 */

// Circuit Breaker
export {
  CircuitBreaker,
  stripeCircuit,
  dbCircuit,
  externalApiCircuit,
  emailCircuit,
  circuitRegistry,
  getAllCircuitStats,
  type CircuitState,
  type CircuitBreakerConfig,
} from './circuit-breaker';

// Retry Logic
export {
  withRetry,
  withRetryResult,
  retryDatabaseOperation,
  retryStripeOperation,
  retryExternalApi,
  retryEmailSend,
  withCircuitBreakerAndRetry,
  type RetryConfig,
  type RetryResult,
} from './retry';

// Fallback & Graceful Degradation
export {
  FallbackService,
  fallback,
  createFallbackFetcher,
  fetchUserWithFallback,
  fetchCircleWithFallback,
  fetchPopularWithFallback,
  featureAvailability,
  withGracefulDegradation,
  fallbackCache,
  type FallbackConfig,
  type CacheEntry,
  type DegradedFeature,
} from './fallback';
