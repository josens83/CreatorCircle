/**
 * Health Check API Endpoints
 * Kubernetes-compatible liveness, readiness, and startup probes
 */

import { NextResponse } from 'next/server';
import { healthChecker, createDatabaseHealthCheck } from '@/lib/monitoring/health';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/monitoring/logger';

// Register database health check
healthChecker.register(
  'database',
  createDatabaseHealthCheck(prisma),
  { critical: true, timeout: 3000 }
);

// =============================================================================
// GET /api/health - Full health check
// =============================================================================

export async function GET(request: Request) {
  const url = new URL(request.url);
  const probe = url.searchParams.get('probe');

  try {
    switch (probe) {
      case 'liveness':
      case 'live': {
        // Simple liveness check - is the process running?
        const result = await healthChecker.liveness();
        return NextResponse.json(result, {
          status: result.alive ? 200 : 503,
        });
      }

      case 'startup': {
        // Startup probe - has the service finished initializing?
        const result = await healthChecker.startup();
        return NextResponse.json(result, {
          status: result.started ? 200 : 503,
        });
      }

      case 'readiness':
      case 'ready':
      default: {
        // Full readiness check
        const result = await healthChecker.readiness();

        const statusCode =
          result.status === 'healthy'
            ? 200
            : result.status === 'degraded'
              ? 200 // Still accept traffic when degraded
              : 503;

        return NextResponse.json(result, {
          status: statusCode,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Health-Status': result.status,
          },
        });
      }
    }
  } catch (error) {
    logger.error('Health check failed', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Status': 'unhealthy',
        },
      }
    );
  }
}

// =============================================================================
// HEAD /api/health - Simple liveness check
// =============================================================================

export async function HEAD() {
  const result = await healthChecker.liveness();
  return new NextResponse(null, {
    status: result.alive ? 200 : 503,
    headers: {
      'X-Health-Status': result.alive ? 'healthy' : 'unhealthy',
    },
  });
}
