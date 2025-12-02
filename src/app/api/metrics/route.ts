/**
 * Prometheus Metrics Endpoint
 * Exposes metrics in Prometheus exposition format
 */

import { NextResponse } from 'next/server';
import {
  getMetrics,
  getMetricsContentType,
  systemMetrics,
} from '@/lib/monitoring/metrics';

// Collect system metrics on each request
// In production, this would be done periodically via systemMetrics.startCollecting()

export async function GET(request: Request) {
  // Collect latest system metrics
  systemMetrics.collect();

  // Check for basic auth in production
  const authHeader = request.headers.get('authorization');
  const metricsPassword = process.env.METRICS_PASSWORD;

  if (metricsPassword && process.env.NODE_ENV === 'production') {
    if (!authHeader) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Metrics"',
        },
      });
    }

    const [, credentials] = authHeader.split(' ');
    const decoded = Buffer.from(credentials || '', 'base64').toString();
    const [, password] = decoded.split(':');

    if (password !== metricsPassword) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const metrics = getMetrics();

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-Type': getMetricsContentType(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
