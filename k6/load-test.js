/**
 * k6 Load Testing Script
 * Netflix/Spotify-grade performance testing
 *
 * Run with: k6 run k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const pageLoadDuration = new Trend('page_load_duration');
const dbQueryDuration = new Trend('db_query_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test scenarios
export const options = {
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
      exec: 'smokeTest',
    },

    // Load test - normal load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { scenario: 'load' },
      startTime: '30s',
      exec: 'loadTest',
    },

    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'stress' },
      startTime: '17m',
      exec: 'stressTest',
    },

    // Spike test - sudden traffic spike
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '10s', target: 500 },  // Spike!
        { duration: '1m', target: 500 },
        { duration: '10s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '10s', target: 0 },
      ],
      tags: { scenario: 'spike' },
      startTime: '40m',
      exec: 'spikeTest',
    },
  },

  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% under 500ms, 99% under 1s
    api_duration: ['p(95)<300', 'p(99)<500'],
    page_load_duration: ['p(95)<1000', 'p(99)<2000'],

    // Error rate thresholds
    errors: ['rate<0.01'],  // Less than 1% errors
    http_req_failed: ['rate<0.01'],

    // Success rate
    successful_requests: ['count>100'],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

function makeRequest(method, url, body = null, params = {}) {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      ...params.headers,
    },
    tags: params.tags || {},
  };

  let response;
  const startTime = Date.now();

  if (method === 'GET') {
    response = http.get(url, options);
  } else if (method === 'POST') {
    response = http.post(url, JSON.stringify(body), options);
  } else if (method === 'PUT') {
    response = http.put(url, JSON.stringify(body), options);
  } else if (method === 'DELETE') {
    response = http.del(url, null, options);
  }

  const duration = Date.now() - startTime;
  apiDuration.add(duration);

  const success = response.status >= 200 && response.status < 300;

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }

  return response;
}

function checkResponse(response, checks) {
  return check(response, checks);
}

// =============================================================================
// Test Scenarios
// =============================================================================

export function smokeTest() {
  group('Smoke Test - Basic Health', () => {
    // Health check
    const healthRes = makeRequest('GET', `${BASE_URL}/api/health`, null, {
      tags: { name: 'health_check' },
    });

    checkResponse(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check has status': (r) => JSON.parse(r.body).status !== undefined,
    });

    // Home page
    const homeRes = makeRequest('GET', BASE_URL, null, {
      tags: { name: 'home_page' },
    });
    pageLoadDuration.add(homeRes.timings.duration);

    checkResponse(homeRes, {
      'home page status is 200': (r) => r.status === 200,
    });

    sleep(1);
  });
}

export function loadTest() {
  group('Load Test - Normal Traffic', () => {
    // Browse circles
    const circlesRes = makeRequest('GET', `${BASE_URL}/api/circles`, null, {
      tags: { name: 'list_circles' },
    });

    checkResponse(circlesRes, {
      'circles list status is 200': (r) => r.status === 200,
      'circles list returns array': (r) => Array.isArray(JSON.parse(r.body).circles || JSON.parse(r.body)),
    });

    sleep(Math.random() * 2 + 1); // Random sleep 1-3s

    // View circle detail (random ID)
    const circles = JSON.parse(circlesRes.body).circles || JSON.parse(circlesRes.body);
    if (circles && circles.length > 0) {
      const randomCircle = circles[Math.floor(Math.random() * circles.length)];

      const circleRes = makeRequest(
        'GET',
        `${BASE_URL}/api/circles/${randomCircle.id}`,
        null,
        { tags: { name: 'view_circle' } }
      );

      checkResponse(circleRes, {
        'circle detail status is 200': (r) => r.status === 200,
      });

      sleep(Math.random() * 3 + 2); // Random sleep 2-5s
    }

    // View posts
    if (circles && circles.length > 0) {
      const randomCircle = circles[Math.floor(Math.random() * circles.length)];

      const postsRes = makeRequest(
        'GET',
        `${BASE_URL}/api/circles/${randomCircle.id}/posts`,
        null,
        { tags: { name: 'list_posts' } }
      );

      checkResponse(postsRes, {
        'posts list returns data': (r) => r.status === 200 || r.status === 403,
      });
    }

    sleep(Math.random() * 2 + 1);
  });
}

export function stressTest() {
  group('Stress Test - High Load', () => {
    // Rapid API calls
    for (let i = 0; i < 5; i++) {
      const res = makeRequest('GET', `${BASE_URL}/api/health`, null, {
        tags: { name: 'stress_health' },
      });

      checkResponse(res, {
        'stress: status OK': (r) => r.status === 200 || r.status === 429,
      });

      sleep(0.1); // Minimal sleep
    }

    // Database-heavy operations
    const circlesRes = makeRequest('GET', `${BASE_URL}/api/circles?limit=50`, null, {
      tags: { name: 'stress_circles' },
    });

    checkResponse(circlesRes, {
      'stress: circles accessible': (r) => r.status !== 500,
    });

    sleep(0.5);
  });
}

export function spikeTest() {
  group('Spike Test - Traffic Surge', () => {
    // Simulate user behavior during spike
    const res = makeRequest('GET', BASE_URL, null, {
      tags: { name: 'spike_home' },
    });

    checkResponse(res, {
      'spike: page loads': (r) => r.status !== 502 && r.status !== 503,
    });

    const apiRes = makeRequest('GET', `${BASE_URL}/api/circles`, null, {
      tags: { name: 'spike_api' },
    });

    checkResponse(apiRes, {
      'spike: API responds': (r) => r.status !== 502 && r.status !== 503,
    });

    sleep(Math.random() * 0.5);
  });
}

// =============================================================================
// Default Function (for simple runs)
// =============================================================================

export default function () {
  loadTest();
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

export function setup() {
  // Warm up the server
  console.log('Warming up server...');

  for (let i = 0; i < 5; i++) {
    http.get(`${BASE_URL}/api/health`);
    sleep(0.5);
  }

  console.log('Warm up complete');

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration.toFixed(2)} seconds`);
}

// =============================================================================
// Summary Handler
// =============================================================================

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_duration_avg: data.metrics.http_req_duration?.values?.avg || 0,
      http_req_duration_p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      http_req_duration_p99: data.metrics.http_req_duration?.values['p(99)'] || 0,
      errors: data.metrics.errors?.values?.rate || 0,
      successful_requests: data.metrics.successful_requests?.values?.count || 0,
      failed_requests: data.metrics.failed_requests?.values?.count || 0,
    },
    thresholds: data.thresholds,
  };

  return {
    'k6/summary.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;

  let output = '\n';
  output += `${indent}===============================================\n`;
  output += `${indent}           LOAD TEST SUMMARY\n`;
  output += `${indent}===============================================\n\n`;

  output += `${indent}Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Success Rate: ${((1 - (data.metrics.errors?.values?.rate || 0)) * 100).toFixed(2)}%\n`;
  output += `${indent}Avg Response Time: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `${indent}P95 Response Time: ${(data.metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `${indent}P99 Response Time: ${(data.metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms\n\n`;

  output += `${indent}Threshold Results:\n`;
  for (const [name, result] of Object.entries(data.thresholds || {})) {
    const status = result.ok ? '✓ PASS' : '✗ FAIL';
    output += `${indent}  ${name}: ${status}\n`;
  }

  return output;
}
