/**
 * Performance Module
 * Centralized exports for performance optimization utilities
 */

// =============================================================================
// Server-Side Data Fetching
// =============================================================================

export {
  // Cached data fetchers
  getUser,
  getCircle,
  getCircles,
  getPosts,
  // Parallel data fetching
  fetchCirclePageData,
  fetchCreatorDashboardData,
  // Preload functions
  preloadCircle,
  preloadUser,
  // Streaming utilities
  createStreamableData,
  streamBatch,
  // Types
  type FetchOptions,
  type PaginationParams,
  type PaginatedResult,
} from './server-fetch';

// =============================================================================
// Image Optimization
// =============================================================================

export {
  // URL generators
  getOptimizedImageUrl,
  generateSrcSet,
  generateSizes,
  // Placeholder generators
  generateBlurPlaceholder,
  generateShimmerPlaceholder,
  // Aspect ratio utilities
  ASPECT_RATIOS,
  calculateDimensions,
  getDimensionsForAspectRatio,
  // Lazy loading
  isInViewport,
  createLazyLoadObserver,
  // Preloading
  preloadImage,
  preloadImages,
  preloadImageWithPriority,
  // Avatar utilities
  getAvatarConfig,
  // Types
  type ImageConfig,
  type ResponsiveImageConfig,
  type ImageDimensions,
  type AspectRatioName,
  type AvatarSize,
} from './image';

// =============================================================================
// API Caching
// =============================================================================

export {
  // Cache manager
  CacheManager,
  MemoryCache,
  apiCache,
  // Presets
  CACHE_PRESETS,
  // HTTP headers
  generateCacheHeaders,
  CACHE_HEADERS,
  // Key generators
  generateCacheKey,
  generateUserCacheKey,
  generateCircleCacheKey,
  // Types
  type CacheEntry,
  type CacheConfig,
  type CacheStats,
  type HttpCacheHeaders,
} from './cache';

// =============================================================================
// Database Optimization
// =============================================================================

export {
  // Query helpers
  measureQuery,
  // Batch processing
  processBatch,
  batchUpsert,
  // Pagination
  cursorPaginate,
  offsetPaginate,
  // Query building
  selectFields,
  optimizedInclude,
  buildWhereClause,
  buildOrderByClause,
  // Transaction helpers
  withRetry,
  interactiveTransaction,
  // Health check
  healthCheck,
  getPoolStatus,
  // Aggregation
  getCounts,
  getStatsSummary,
  // Types
  type QueryOptions,
  type BatchOptions,
  type PaginationOptions,
} from './database';

// =============================================================================
// React Hooks (Client-Side)
// =============================================================================

export {
  // Core Web Vitals
  useWebVitals,
  // Debounce/Throttle
  useDebounce,
  useDebouncedCallback,
  useThrottledCallback,
  // Intersection Observer
  useIntersection,
  // Virtual List
  useVirtualList,
  // State optimization
  useDeferredState,
  usePrevious,
  // Idle callback
  useIdleCallback,
  // Monitoring
  useMemoryUsage,
  useResourceTiming,
  useRenderCount,
  // Types
  type PerformanceMetrics,
  type ResourceTiming,
} from './hooks';

// =============================================================================
// Performance Best Practices Reference
// =============================================================================

/**
 * Performance Optimization Checklist:
 *
 * Server-Side:
 * - Use React Server Components for data fetching
 * - Implement parallel data fetching with Promise.all
 * - Use React cache() for request deduplication
 * - Implement cursor-based pagination for large datasets
 * - Use database connection pooling
 * - Add query performance monitoring
 *
 * Client-Side:
 * - Lazy load images with blur placeholders
 * - Implement virtual scrolling for long lists
 * - Use useTransition for non-urgent updates
 * - Debounce/throttle expensive operations
 * - Monitor Core Web Vitals
 *
 * Caching:
 * - Use SWR pattern for API responses
 * - Set appropriate Cache-Control headers
 * - Implement cache invalidation by tags
 * - Use ETags for conditional requests
 *
 * Images:
 * - Use next/image for automatic optimization
 * - Generate responsive srcset
 * - Implement lazy loading with IntersectionObserver
 * - Use WebP/AVIF formats where supported
 * - Provide blur placeholders for perceived performance
 */

// =============================================================================
// Performance Thresholds (Google's recommendations)
// =============================================================================

export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  LCP: {
    good: 2500,      // ≤ 2.5s
    needsImprovement: 4000, // ≤ 4s
  },
  FID: {
    good: 100,       // ≤ 100ms
    needsImprovement: 300, // ≤ 300ms
  },
  CLS: {
    good: 0.1,       // ≤ 0.1
    needsImprovement: 0.25, // ≤ 0.25
  },
  INP: {
    good: 200,       // ≤ 200ms
    needsImprovement: 500, // ≤ 500ms
  },

  // API Response Times
  API: {
    fast: 100,       // ≤ 100ms
    acceptable: 300, // ≤ 300ms
    slow: 1000,      // ≤ 1s
  },

  // Database Queries
  DB: {
    fast: 50,        // ≤ 50ms
    acceptable: 100, // ≤ 100ms
    slow: 500,       // ≤ 500ms
  },
} as const;

/**
 * Check if metric meets threshold
 */
export function meetsThreshold(
  metric: 'LCP' | 'FID' | 'CLS' | 'INP' | 'API' | 'DB',
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = PERFORMANCE_THRESHOLDS[metric];

  if (value <= thresholds.good) {
    return 'good';
  }

  if (value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  }

  return 'poor';
}
