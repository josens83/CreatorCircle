/**
 * API Response Caching Layer
 * Multi-tier caching with SWR patterns
 */

import { logger } from '@/lib/monitoring/logger';

// =============================================================================
// Types
// =============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  staleAt: number;
  tags: string[];
  etag?: string;
}

export interface CacheConfig {
  ttl: number;           // Time to live in milliseconds
  staleWhileRevalidate: number;  // Additional time data can be served while revalidating
  maxSize?: number;      // Maximum cache entries
  tags?: string[];       // Cache tags for invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  size: number;
  hitRate: number;
}

type RevalidateCallback<T> = () => Promise<T>;

// =============================================================================
// In-Memory Cache Implementation
// =============================================================================

export class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats = { hits: 0, misses: 0, staleHits: 0 };
  private maxSize: number;
  private revalidating: Set<string> = new Set();

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();

    // Entry has expired completely
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Entry is fresh
    if (now < entry.staleAt) {
      this.stats.hits++;
      return entry;
    }

    // Entry is stale but within revalidation window
    this.stats.staleHits++;
    return entry;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, config: CacheConfig): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      staleAt: now + config.ttl,
      expiresAt: now + config.ttl + config.staleWhileRevalidate,
      tags: config.tags || [],
      etag: this.generateETag(data),
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate by tag
   */
  invalidateByTag(tag: string): number {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    logger.debug(`Cache invalidated by tag: ${tag}`, { count: invalidated });
    return invalidated;
  }

  /**
   * Invalidate by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0;

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, staleHits: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses + this.stats.staleHits;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits + this.stats.staleHits) / total : 0,
    };
  }

  /**
   * Check if currently revalidating
   */
  isRevalidating(key: string): boolean {
    return this.revalidating.has(key);
  }

  /**
   * Mark as revalidating
   */
  markRevalidating(key: string): void {
    this.revalidating.add(key);
  }

  /**
   * Unmark revalidating
   */
  unmarkRevalidating(key: string): void {
    this.revalidating.delete(key);
  }

  private evictOldest(): void {
    const oldest = this.cache.keys().next().value;
    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  private generateETag(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `"${Math.abs(hash).toString(36)}"`;
  }
}

// =============================================================================
// Cache Manager with SWR Support
// =============================================================================

export class CacheManager {
  private memoryCache: MemoryCache;
  private static instance: CacheManager;

  constructor(maxSize?: number) {
    this.memoryCache = new MemoryCache(maxSize);
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get or fetch with SWR pattern
   */
  async getOrFetch<T>(
    key: string,
    fetcher: RevalidateCallback<T>,
    config: CacheConfig
  ): Promise<T> {
    const cached = this.memoryCache.get<T>(key);
    const now = Date.now();

    // Cache hit - fresh data
    if (cached && now < cached.staleAt) {
      return cached.data;
    }

    // Cache hit - stale data, revalidate in background
    if (cached && now < cached.expiresAt) {
      if (!this.memoryCache.isRevalidating(key)) {
        this.revalidateInBackground(key, fetcher, config);
      }
      return cached.data;
    }

    // Cache miss - fetch fresh data
    const data = await fetcher();
    this.memoryCache.set(key, data, config);
    return data;
  }

  /**
   * Revalidate in background (SWR)
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: RevalidateCallback<T>,
    config: CacheConfig
  ): Promise<void> {
    this.memoryCache.markRevalidating(key);

    try {
      const data = await fetcher();
      this.memoryCache.set(key, data, config);
      logger.debug(`Cache revalidated: ${key}`);
    } catch (error) {
      logger.error(`Cache revalidation failed: ${key}`, error);
    } finally {
      this.memoryCache.unmarkRevalidating(key);
    }
  }

  /**
   * Invalidate cache by key
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
  }

  /**
   * Invalidate by tag
   */
  invalidateByTag(tag: string): number {
    return this.memoryCache.invalidateByTag(tag);
  }

  /**
   * Invalidate by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    return this.memoryCache.invalidateByPattern(pattern);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
  }

  /**
   * Get statistics
   */
  getStats(): CacheStats {
    return this.memoryCache.getStats();
  }
}

// =============================================================================
// API Response Cache Wrapper
// =============================================================================

export const apiCache = CacheManager.getInstance();

/**
 * Cache configuration presets
 */
export const CACHE_PRESETS = {
  // Static data - rarely changes
  static: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    staleWhileRevalidate: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // User data - moderate freshness
  user: {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: 30 * 60 * 1000, // 30 minutes
  },

  // List data - needs fresher data
  list: {
    ttl: 60 * 1000, // 1 minute
    staleWhileRevalidate: 5 * 60 * 1000, // 5 minutes
  },

  // Real-time data - minimal caching
  realtime: {
    ttl: 10 * 1000, // 10 seconds
    staleWhileRevalidate: 30 * 1000, // 30 seconds
  },

  // Session data - short lived
  session: {
    ttl: 30 * 1000, // 30 seconds
    staleWhileRevalidate: 60 * 1000, // 1 minute
  },
} as const;

// =============================================================================
// HTTP Caching Headers
// =============================================================================

export interface HttpCacheHeaders {
  'Cache-Control': string;
  ETag?: string;
  'Last-Modified'?: string;
  Vary?: string;
}

/**
 * Generate HTTP cache headers
 */
export function generateCacheHeaders(config: {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  private?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  etag?: string;
  lastModified?: Date;
  vary?: string[];
}): HttpCacheHeaders {
  const directives: string[] = [];

  if (config.noStore) {
    directives.push('no-store');
  } else {
    if (config.private) {
      directives.push('private');
    } else {
      directives.push('public');
    }

    if (config.maxAge !== undefined) {
      directives.push(`max-age=${config.maxAge}`);
    }

    if (config.sMaxAge !== undefined) {
      directives.push(`s-maxage=${config.sMaxAge}`);
    }

    if (config.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }

    if (config.staleIfError !== undefined) {
      directives.push(`stale-if-error=${config.staleIfError}`);
    }

    if (config.mustRevalidate) {
      directives.push('must-revalidate');
    }
  }

  const headers: HttpCacheHeaders = {
    'Cache-Control': directives.join(', '),
  };

  if (config.etag) {
    headers.ETag = config.etag;
  }

  if (config.lastModified) {
    headers['Last-Modified'] = config.lastModified.toUTCString();
  }

  if (config.vary && config.vary.length > 0) {
    headers.Vary = config.vary.join(', ');
  }

  return headers;
}

/**
 * Common cache header configurations
 */
export const CACHE_HEADERS = {
  // Public API responses
  publicApi: () =>
    generateCacheHeaders({
      maxAge: 60,
      sMaxAge: 300,
      staleWhileRevalidate: 3600,
      vary: ['Accept', 'Accept-Encoding'],
    }),

  // Private user data
  privateData: () =>
    generateCacheHeaders({
      private: true,
      maxAge: 0,
      mustRevalidate: true,
    }),

  // Static assets
  staticAsset: () =>
    generateCacheHeaders({
      maxAge: 31536000, // 1 year
      immutable: true,
    } as Parameters<typeof generateCacheHeaders>[0]),

  // No caching
  noCache: () =>
    generateCacheHeaders({
      noStore: true,
    }),

  // Conditional caching
  conditional: (etag: string, lastModified?: Date) =>
    generateCacheHeaders({
      maxAge: 0,
      mustRevalidate: true,
      etag,
      lastModified,
    }),
};

// =============================================================================
// Cache Key Generators
// =============================================================================

/**
 * Generate cache key for API requests
 */
export function generateCacheKey(
  prefix: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${prefix}:${sortedParams}`;
}

/**
 * Generate cache key for user-specific data
 */
export function generateUserCacheKey(
  userId: string,
  resource: string,
  params?: Record<string, unknown>
): string {
  const base = `user:${userId}:${resource}`;
  return params ? generateCacheKey(base, params) : base;
}

/**
 * Generate cache key for circle data
 */
export function generateCircleCacheKey(
  circleId: string,
  resource: string,
  params?: Record<string, unknown>
): string {
  const base = `circle:${circleId}:${resource}`;
  return params ? generateCacheKey(base, params) : base;
}
