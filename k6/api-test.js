/**
 * k6 API Load Testing Script
 * Focused performance testing for API endpoints
 *
 * Run with: k6 run k6/api-test.js --env BASE_URL=http://localhost:3000
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics per endpoint
const healthCheckDuration = new Trend('health_check_duration');
const circlesListDuration = new Trend('circles_list_duration');
const circleDetailDuration = new Trend('circle_detail_duration');
const postsListDuration = new Trend('posts_list_duration');
const metricsEndpointDuration = new Trend('metrics_endpoint_duration');

const errorRate = new Rate('error_rate');
const rateLimitHits = new Counter('rate_limit_hits');

// Test options
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm up
    { duration: '1m', target: 25 },    // Normal load
    { duration: '2m', target: 50 },    // High load
    { duration: '1m', target: 25 },    // Scale down
    { duration: '30s', target: 0 },    // Cool down
  ],

  thresholds: {
    // Global thresholds
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.05'],

    // Per-endpoint thresholds
    health_check_duration: ['p(95)<100', 'p(99)<200'],
    circles_list_duration: ['p(95)<300', 'p(99)<500'],
    circle_detail_duration: ['p(95)<200', 'p(99)<400'],
    posts_list_duration: ['p(95)<300', 'p(99)<500'],
    metrics_endpoint_duration: ['p(95)<500'],
  },
};

// =============================================================================
// API Helper
// =============================================================================

function apiRequest(method, endpoint, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let response;

  switch (method.toUpperCase()) {
    case 'GET':
      response = http.get(url, params);
      break;
    case 'POST':
      response = http.post(url, JSON.stringify(body), params);
      break;
    case 'PUT':
      response = http.put(url, JSON.stringify(body), params);
      break;
    case 'DELETE':
      response = http.del(url, null, params);
      break;
  }

  // Track rate limiting
  if (response.status === 429) {
    rateLimitHits.add(1);
  }

  // Track errors
  if (response.status >= 400 && response.status !== 429) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  return response;
}

// =============================================================================
// Test Scenarios
// =============================================================================

export default function () {
  // Health Check Endpoint
  group('Health Check', () => {
    const response = apiRequest('GET', '/api/health');
    healthCheckDuration.add(response.timings.duration);

    check(response, {
      'health: status is 200': (r) => r.status === 200,
      'health: has status field': (r) => {
        try {
          return JSON.parse(r.body).status !== undefined;
        } catch {
          return false;
        }
      },
      'health: response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  sleep(0.5);

  // Circles List Endpoint
  group('Circles List', () => {
    const response = apiRequest('GET', '/api/circles');
    circlesListDuration.add(response.timings.duration);

    const success = check(response, {
      'circles: status is 200': (r) => r.status === 200,
      'circles: returns data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) || Array.isArray(body.circles);
        } catch {
          return false;
        }
      },
      'circles: response time < 300ms': (r) => r.timings.duration < 300,
    });

    // If successful, test pagination
    if (success && response.status === 200) {
      const paginatedResponse = apiRequest('GET', '/api/circles?page=1&limit=10');
      check(paginatedResponse, {
        'circles pagination works': (r) => r.status === 200,
      });
    }
  });

  sleep(0.5);

  // Circle Detail (if circles exist)
  group('Circle Detail', () => {
    // First get a circle ID
    const listResponse = apiRequest('GET', '/api/circles?limit=1');

    if (listResponse.status === 200) {
      try {
        const data = JSON.parse(listResponse.body);
        const circles = Array.isArray(data) ? data : data.circles;

        if (circles && circles.length > 0) {
          const circleId = circles[0].id;
          const detailResponse = apiRequest('GET', `/api/circles/${circleId}`);
          circleDetailDuration.add(detailResponse.timings.duration);

          check(detailResponse, {
            'circle detail: status is 200': (r) => r.status === 200,
            'circle detail: has id': (r) => {
              try {
                return JSON.parse(r.body).id === circleId;
              } catch {
                return false;
              }
            },
            'circle detail: response time < 200ms': (r) =>
              r.timings.duration < 200,
          });
        }
      } catch {
        // Parsing failed, skip
      }
    }
  });

  sleep(0.5);

  // Posts List
  group('Posts List', () => {
    const listResponse = apiRequest('GET', '/api/circles?limit=1');

    if (listResponse.status === 200) {
      try {
        const data = JSON.parse(listResponse.body);
        const circles = Array.isArray(data) ? data : data.circles;

        if (circles && circles.length > 0) {
          const circleId = circles[0].id;
          const postsResponse = apiRequest(
            'GET',
            `/api/circles/${circleId}/posts`
          );
          postsListDuration.add(postsResponse.timings.duration);

          check(postsResponse, {
            'posts: status is 200 or 403': (r) =>
              r.status === 200 || r.status === 403,
            'posts: response time < 300ms': (r) => r.timings.duration < 300,
          });
        }
      } catch {
        // Parsing failed, skip
      }
    }
  });

  sleep(0.5);

  // Metrics Endpoint (if available)
  group('Metrics Endpoint', () => {
    const response = apiRequest('GET', '/api/metrics');
    metricsEndpointDuration.add(response.timings.duration);

    check(response, {
      'metrics: accessible': (r) =>
        r.status === 200 || r.status === 401 || r.status === 403,
      'metrics: response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(1);
}

// =============================================================================
// Setup and Teardown
// =============================================================================

export function setup() {
  console.log(`Starting API load test against ${BASE_URL}`);

  // Verify server is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);

  if (healthCheck.status !== 200) {
    console.error('Server health check failed!');
    return { serverHealthy: false };
  }

  console.log('Server is healthy, starting tests...');
  return { serverHealthy: true, startTime: Date.now() };
}

export function teardown(data) {
  if (data.serverHealthy) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log(`API load test completed in ${duration.toFixed(2)} seconds`);
  } else {
    console.error('Test aborted due to unhealthy server');
  }
}
