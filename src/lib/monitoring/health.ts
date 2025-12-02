/**
 * Health Check System
 * Kubernetes-compatible liveness, readiness, and startup probes
 */

import { logger } from './logger';

// =============================================================================
// Types
// =============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastCheck?: number;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  version?: string;
  uptime: number;
  checks: ComponentHealth[];
}

export interface HealthCheckConfig {
  timeout: number;
  critical: boolean;
}

type HealthCheckFn = () => Promise<ComponentHealth>;

// =============================================================================
// Health Checker Registry
// =============================================================================

class HealthChecker {
  private checks: Map<string, { fn: HealthCheckFn; config: HealthCheckConfig }> =
    new Map();
  private cache: Map<string, { result: ComponentHealth; expiry: number }> =
    new Map();
  private cacheMs = 5000; // Cache health results for 5 seconds
  private static instance: HealthChecker;

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  register(
    name: string,
    checkFn: HealthCheckFn,
    config: Partial<HealthCheckConfig> = {}
  ): void {
    this.checks.set(name, {
      fn: checkFn,
      config: {
        timeout: config.timeout || 5000,
        critical: config.critical ?? true,
      },
    });
  }

  unregister(name: string): void {
    this.checks.delete(name);
  }

  async runCheck(name: string): Promise<ComponentHealth> {
    const check = this.checks.get(name);
    if (!check) {
      return {
        name,
        status: 'unhealthy',
        message: 'Health check not registered',
      };
    }

    // Check cache
    const cached = this.cache.get(name);
    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }

    const startTime = performance.now();

    try {
      // Run with timeout
      const result = await Promise.race([
        check.fn(),
        new Promise<ComponentHealth>((_, reject) =>
          setTimeout(
            () => reject(new Error('Health check timeout')),
            check.config.timeout
          )
        ),
      ]);

      result.latency = Math.round(performance.now() - startTime);
      result.lastCheck = Date.now();

      // Update cache
      this.cache.set(name, {
        result,
        expiry: Date.now() + this.cacheMs,
      });

      return result;
    } catch (error) {
      const result: ComponentHealth = {
        name,
        status: 'unhealthy',
        latency: Math.round(performance.now() - startTime),
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: Date.now(),
      };

      this.cache.set(name, {
        result,
        expiry: Date.now() + this.cacheMs,
      });

      return result;
    }
  }

  async runAllChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkPromises = Array.from(this.checks.keys()).map((name) =>
      this.runCheck(name)
    );

    const results = await Promise.all(checkPromises);

    // Determine overall status
    let overallStatus: HealthStatus = 'healthy';

    for (const result of results) {
      const check = this.checks.get(result.name);
      if (check?.config.critical && result.status === 'unhealthy') {
        overallStatus = 'unhealthy';
        break;
      }
      if (result.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      timestamp: startTime,
      version: process.env.NEXT_PUBLIC_VERSION || 'unknown',
      uptime: process.uptime(),
      checks: results,
    };
  }

  // Liveness: Is the process running?
  async liveness(): Promise<{ alive: boolean }> {
    return { alive: true };
  }

  // Readiness: Is the service ready to accept traffic?
  async readiness(): Promise<HealthCheckResult> {
    return this.runAllChecks();
  }

  // Startup: Has the service finished initializing?
  async startup(): Promise<{ started: boolean; checks: ComponentHealth[] }> {
    const result = await this.runAllChecks();
    return {
      started: result.status !== 'unhealthy',
      checks: result.checks,
    };
  }
}

// =============================================================================
// Pre-built Health Checks
// =============================================================================

// Database health check
export function createDatabaseHealthCheck(
  prismaClient: { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> }
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    try {
      await prismaClient.$queryRaw`SELECT 1`;
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection successful',
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        name: 'database',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database error',
      };
    }
  };
}

// Redis health check
export function createRedisHealthCheck(
  redisClient: { ping: () => Promise<string> } | null
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    if (!redisClient) {
      return {
        name: 'redis',
        status: 'healthy',
        message: 'Redis not configured (using in-memory fallback)',
      };
    }

    try {
      const result = await redisClient.ping();
      return {
        name: 'redis',
        status: result === 'PONG' ? 'healthy' : 'degraded',
        message: 'Redis connection successful',
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Redis error',
      };
    }
  };
}

// Stripe health check
export function createStripeHealthCheck(
  stripeClient: { balance: { retrieve: () => Promise<unknown> } } | null
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    if (!stripeClient) {
      return {
        name: 'stripe',
        status: 'degraded',
        message: 'Stripe not configured',
      };
    }

    try {
      await stripeClient.balance.retrieve();
      return {
        name: 'stripe',
        status: 'healthy',
        message: 'Stripe API accessible',
      };
    } catch (error) {
      return {
        name: 'stripe',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Stripe error',
      };
    }
  };
}

// Memory health check
export function createMemoryHealthCheck(
  thresholdMb: number = 512
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    const memUsage = process.memoryUsage();
    const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usagePercent = Math.round((heapUsedMb / heapTotalMb) * 100);

    let status: HealthStatus = 'healthy';
    if (heapUsedMb > thresholdMb) {
      status = 'degraded';
    }
    if (usagePercent > 90) {
      status = 'unhealthy';
    }

    return {
      name: 'memory',
      status,
      message: `Heap: ${heapUsedMb}MB / ${heapTotalMb}MB (${usagePercent}%)`,
      details: {
        heapUsedMb,
        heapTotalMb,
        usagePercent,
        rssMb: Math.round(memUsage.rss / 1024 / 1024),
      },
    };
  };
}

// Disk space health check (for file uploads, logs, etc.)
export function createDiskHealthCheck(
  path: string = '/',
  thresholdPercent: number = 90
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    // Simplified check - in production, use statvfs or similar
    try {
      const { execSync } = await import('child_process');
      const result = execSync(`df -h ${path} | tail -1`, { encoding: 'utf8' });
      const parts = result.split(/\s+/);
      const usagePercent = parseInt(parts[4], 10);

      let status: HealthStatus = 'healthy';
      if (usagePercent > thresholdPercent - 10) {
        status = 'degraded';
      }
      if (usagePercent > thresholdPercent) {
        status = 'unhealthy';
      }

      return {
        name: 'disk',
        status,
        message: `Disk usage: ${usagePercent}%`,
        details: {
          path,
          size: parts[1],
          used: parts[2],
          available: parts[3],
          usagePercent,
        },
      };
    } catch {
      // Fallback for environments without df
      return {
        name: 'disk',
        status: 'healthy',
        message: 'Disk check not available',
      };
    }
  };
}

// External API health check
export function createExternalApiHealthCheck(
  name: string,
  url: string,
  expectedStatus: number = 200
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const isHealthy = response.status === expectedStatus;
      return {
        name: `external_${name}`,
        status: isHealthy ? 'healthy' : 'degraded',
        message: `Status: ${response.status}`,
        details: {
          url,
          status: response.status,
        },
      };
    } catch (error) {
      return {
        name: `external_${name}`,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Request failed',
        details: { url },
      };
    }
  };
}

// =============================================================================
// Circuit Breaker Health Integration
// =============================================================================

export function createCircuitBreakerHealthCheck(
  circuitBreakers: Array<{ getName: () => string; getState: () => string }>
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    const states = circuitBreakers.map((cb) => ({
      name: cb.getName(),
      state: cb.getState(),
    }));

    const openCircuits = states.filter((s) => s.state === 'OPEN');
    const halfOpenCircuits = states.filter((s) => s.state === 'HALF_OPEN');

    let status: HealthStatus = 'healthy';
    let message = 'All circuit breakers closed';

    if (halfOpenCircuits.length > 0) {
      status = 'degraded';
      message = `${halfOpenCircuits.length} circuit(s) recovering`;
    }

    if (openCircuits.length > 0) {
      status = 'unhealthy';
      message = `${openCircuits.length} circuit(s) open: ${openCircuits.map((c) => c.name).join(', ')}`;
    }

    return {
      name: 'circuit_breakers',
      status,
      message,
      details: { circuits: states },
    };
  };
}

// =============================================================================
// Dependency Graph Health
// =============================================================================

export interface DependencyNode {
  name: string;
  type: 'critical' | 'optional';
  dependencies?: string[];
}

export function createDependencyHealthCheck(
  dependencies: DependencyNode[],
  healthChecker: HealthChecker
): HealthCheckFn {
  return async (): Promise<ComponentHealth> => {
    const results = new Map<string, ComponentHealth>();

    // Run all dependency checks
    for (const dep of dependencies) {
      const result = await healthChecker.runCheck(dep.name);
      results.set(dep.name, result);
    }

    // Analyze dependency graph
    const criticalFailures = dependencies.filter(
      (d) => d.type === 'critical' && results.get(d.name)?.status === 'unhealthy'
    );

    const optionalFailures = dependencies.filter(
      (d) => d.type === 'optional' && results.get(d.name)?.status === 'unhealthy'
    );

    let status: HealthStatus = 'healthy';
    let message = 'All dependencies healthy';

    if (optionalFailures.length > 0) {
      status = 'degraded';
      message = `Optional dependencies degraded: ${optionalFailures.map((d) => d.name).join(', ')}`;
    }

    if (criticalFailures.length > 0) {
      status = 'unhealthy';
      message = `Critical dependencies failed: ${criticalFailures.map((d) => d.name).join(', ')}`;
    }

    return {
      name: 'dependencies',
      status,
      message,
      details: {
        critical: dependencies
          .filter((d) => d.type === 'critical')
          .map((d) => ({ name: d.name, status: results.get(d.name)?.status })),
        optional: dependencies
          .filter((d) => d.type === 'optional')
          .map((d) => ({ name: d.name, status: results.get(d.name)?.status })),
      },
    };
  };
}

// =============================================================================
// Exports
// =============================================================================

export const healthChecker = HealthChecker.getInstance();

// Register default checks
healthChecker.register('memory', createMemoryHealthCheck(), { critical: false });
healthChecker.register('disk', createDiskHealthCheck(), { critical: false });
