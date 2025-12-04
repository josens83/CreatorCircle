/**
 * Vitest Test Setup
 * Global test configuration and utilities
 */

import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// =============================================================================
// Extend Vitest with Testing Library matchers
// =============================================================================

expect.extend(matchers);

// =============================================================================
// Global Test Lifecycle
// =============================================================================

beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing';
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
});

afterEach(() => {
  // Clean up React Testing Library
  cleanup();

  // Clear all mocks
  vi.clearAllMocks();
});

afterAll(() => {
  // Clean up any remaining resources
  vi.restoreAllMocks();
});

// =============================================================================
// Global Mocks
// =============================================================================

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Map(),
}));

// Mock crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    },
  });
}

// Mock performance.now if not available
if (typeof performance === 'undefined') {
  (globalThis as unknown as { performance: { now: () => number } }).performance = {
    now: () => Date.now(),
  };
}

// =============================================================================
// Custom Matchers
// =============================================================================

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeValidUUID(received: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
});

// =============================================================================
// TypeScript Declaration
// =============================================================================

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toBeWithinRange(floor: number, ceiling: number): T;
    toBeValidUUID(): T;
  }
  interface AsymmetricMatchersContaining {
    toBeWithinRange(floor: number, ceiling: number): unknown;
    toBeValidUUID(): unknown;
  }
}

// =============================================================================
// Console Suppression for Tests
// =============================================================================

const originalConsole = { ...console };

// Suppress console during tests (optional - uncomment if needed)
// beforeAll(() => {
//   console.log = vi.fn();
//   console.warn = vi.fn();
//   console.error = vi.fn();
// });
//
// afterAll(() => {
//   console.log = originalConsole.log;
//   console.warn = originalConsole.warn;
//   console.error = originalConsole.error;
// });

export { originalConsole };
