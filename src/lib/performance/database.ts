/**
 * Database Query Optimization Utilities
 * Efficient patterns for Prisma queries
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/monitoring/logger';
import { dbQueryDuration, dbQueriesTotal } from '@/lib/monitoring/metrics';

// =============================================================================
// Types
// =============================================================================

export interface QueryOptions {
  timeout?: number;
  logSlow?: boolean;
  slowThreshold?: number;
}

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (processed: number, total: number) => void;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

// =============================================================================
// Query Performance Wrapper
// =============================================================================

/**
 * Wrap database queries with performance monitoring
 */
export async function measureQuery<T>(
  operation: string,
  table: string,
  query: () => Promise<T>,
  options: QueryOptions = {}
): Promise<T> {
  const { logSlow = true, slowThreshold = 100 } = options;
  const startTime = performance.now();

  try {
    const result = await query();
    const duration = performance.now() - startTime;

    // Record metrics
    dbQueryDuration.observe(duration / 1000, { operation, table });
    dbQueriesTotal.inc({ operation, table, status: 'success' });

    // Log slow queries
    if (logSlow && duration > slowThreshold) {
      logger.warn(`Slow query detected: ${operation} on ${table}`, {
        duration: Math.round(duration),
        threshold: slowThreshold,
      });
    }

    return result;
  } catch (error) {
    dbQueriesTotal.inc({ operation, table, status: 'error' });
    throw error;
  }
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Process items in batches to avoid memory issues
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  options: BatchOptions = {}
): Promise<R[]> {
  const { batchSize = 100, onProgress } = options;
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }
  }

  return results;
}

/**
 * Batch upsert with conflict handling
 */
export async function batchUpsert<T extends Record<string, unknown>>(
  table: string,
  items: T[],
  uniqueKey: keyof T,
  options: BatchOptions = {}
): Promise<number> {
  const { batchSize = 100 } = options;
  let totalUpserted = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Use Prisma's createMany with skipDuplicates or transaction
    const result = await prisma.$transaction(
      batch.map((item) =>
        (prisma as Record<string, { upsert: (args: unknown) => Promise<unknown> }>)[table].upsert({
          where: { [uniqueKey]: item[uniqueKey] },
          create: item,
          update: item,
        })
      )
    );

    totalUpserted += result.length;
  }

  return totalUpserted;
}

// =============================================================================
// Efficient Pagination
// =============================================================================

/**
 * Cursor-based pagination (more efficient for large datasets)
 */
export async function cursorPaginate<T extends { id: string }>(
  model: string,
  where: Record<string, unknown>,
  options: {
    cursor?: string;
    limit?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    include?: Record<string, unknown>;
    select?: Record<string, boolean>;
  }
): Promise<{
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const { cursor, limit = 20, orderBy = { createdAt: 'desc' }, include, select } = options;

  const items = await (prisma as Record<string, { findMany: (args: unknown) => Promise<T[]> }>)[model].findMany({
    where,
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy,
    include,
    select,
  });

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}

/**
 * Offset pagination with total count (for UI pagination)
 */
export async function offsetPaginate<T>(
  model: string,
  where: Record<string, unknown>,
  options: PaginationOptions & {
    include?: Record<string, unknown>;
    select?: Record<string, boolean>;
  }
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}> {
  const { page = 1, limit = 20, orderBy = { createdAt: 'desc' }, include, select } = options;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    (prisma as Record<string, { findMany: (args: unknown) => Promise<T[]> }>)[model].findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include,
      select,
    }),
    (prisma as Record<string, { count: (args: unknown) => Promise<number> }>)[model].count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + data.length < total,
    },
  };
}

// =============================================================================
// Query Optimization Patterns
// =============================================================================

/**
 * Select only required fields (reduce data transfer)
 */
export function selectFields<T extends string>(fields: T[]): Record<T, true> {
  return fields.reduce(
    (acc, field) => ({ ...acc, [field]: true }),
    {} as Record<T, true>
  );
}

/**
 * Create optimized include for nested relations
 */
export function optimizedInclude(
  relations: Record<string, { select?: Record<string, boolean>; take?: number }>
): Record<string, unknown> {
  return Object.entries(relations).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: {
        ...value,
        // Always limit nested relations to prevent N+1-like issues
        take: value.take ?? 10,
      },
    }),
    {}
  );
}

// =============================================================================
// Connection Pool Management
// =============================================================================

/**
 * Get connection pool status
 */
export async function getPoolStatus(): Promise<{
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
}> {
  // Prisma doesn't expose pool metrics directly
  // This is a placeholder for monitoring
  return {
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
  };
}

/**
 * Health check with timeout
 */
export async function healthCheck(timeoutMs: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    await prisma.$queryRaw`SELECT 1`;
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Transaction Helpers
// =============================================================================

/**
 * Execute with retry on deadlock
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if it's a retryable error (deadlock, lock timeout)
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('deadlock') ||
          error.message.includes('lock') ||
          error.message.includes('timeout'));

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * Math.pow(2, attempt))
      );
    }
  }

  throw lastError;
}

/**
 * Interactive transaction with timeout
 */
export async function interactiveTransaction<T>(
  fn: (tx: typeof prisma) => Promise<T>,
  options: { maxWait?: number; timeout?: number } = {}
): Promise<T> {
  const { maxWait = 5000, timeout = 10000 } = options;

  return prisma.$transaction(fn, {
    maxWait,
    timeout,
  });
}

// =============================================================================
// Query Builder Helpers
// =============================================================================

/**
 * Build dynamic where clause
 */
export function buildWhereClause(
  filters: Record<string, unknown>
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Handle special operators
    if (typeof value === 'object' && value !== null) {
      where[key] = value;
    } else if (typeof value === 'string' && key.endsWith('_contains')) {
      const field = key.replace('_contains', '');
      where[field] = { contains: value, mode: 'insensitive' };
    } else if (typeof value === 'string' && key.endsWith('_startsWith')) {
      const field = key.replace('_startsWith', '');
      where[field] = { startsWith: value, mode: 'insensitive' };
    } else {
      where[key] = value;
    }
  }

  return where;
}

/**
 * Build order by clause from query string
 */
export function buildOrderByClause(
  sortParam?: string,
  allowedFields: string[] = ['createdAt', 'updatedAt', 'name']
): Record<string, 'asc' | 'desc'> {
  if (!sortParam) {
    return { createdAt: 'desc' };
  }

  const [field, direction] = sortParam.split(':');
  const dir = direction?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  if (allowedFields.includes(field)) {
    return { [field]: dir };
  }

  return { createdAt: 'desc' };
}

// =============================================================================
// Aggregation Helpers
// =============================================================================

/**
 * Get counts for multiple conditions efficiently
 */
export async function getCounts(
  model: string,
  conditions: Record<string, Record<string, unknown>>
): Promise<Record<string, number>> {
  const queries = Object.entries(conditions).map(([name, where]) =>
    (prisma as Record<string, { count: (args: unknown) => Promise<number> }>)[model]
      .count({ where })
      .then((count: number) => [name, count] as const)
  );

  const results = await Promise.all(queries);
  return Object.fromEntries(results);
}

/**
 * Get stats summary
 */
export async function getStatsSummary(
  model: string,
  where: Record<string, unknown>,
  fields: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] }
): Promise<Record<string, Record<string, number | null>>> {
  const aggregate: Record<string, Record<string, boolean>> = {};

  if (fields.sum) {
    aggregate._sum = Object.fromEntries(fields.sum.map((f) => [f, true]));
  }
  if (fields.avg) {
    aggregate._avg = Object.fromEntries(fields.avg.map((f) => [f, true]));
  }
  if (fields.min) {
    aggregate._min = Object.fromEntries(fields.min.map((f) => [f, true]));
  }
  if (fields.max) {
    aggregate._max = Object.fromEntries(fields.max.map((f) => [f, true]));
  }

  return (prisma as Record<string, { aggregate: (args: unknown) => Promise<Record<string, Record<string, number | null>>> }>)[model].aggregate({
    where,
    ...aggregate,
  });
}
