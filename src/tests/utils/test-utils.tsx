/**
 * Test Utilities
 * Common utilities for testing React components and API routes
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// =============================================================================
// Provider Wrapper
// =============================================================================

interface TestProvidersProps {
  children: React.ReactNode;
}

function TestProviders({ children }: TestProvidersProps): ReactElement {
  // Add your providers here (e.g., ThemeProvider, SessionProvider)
  return <>{children}</>;
}

// =============================================================================
// Custom Render
// =============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Record<string, unknown>;
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();

  return {
    user,
    ...render(ui, {
      wrapper: TestProviders,
      ...options,
    }),
  };
}

// =============================================================================
// API Testing Utilities
// =============================================================================

interface MockRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  searchParams?: Record<string, string>;
}

export function createMockRequest(
  url: string,
  options: MockRequestOptions = {}
): Request {
  const { method = 'GET', headers = {}, body, searchParams } = options;

  let fullUrl = url;
  if (searchParams) {
    const params = new URLSearchParams(searchParams);
    fullUrl = `${url}?${params.toString()}`;
  }

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = JSON.stringify(body);
  }

  return new Request(fullUrl, requestInit);
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Failed to parse response as JSON: ${text}`);
  }
}

// =============================================================================
// Wait Utilities
// =============================================================================

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

// =============================================================================
// Mock Data Generators
// =============================================================================

let idCounter = 0;

export function generateId(prefix = 'test'): string {
  return `${prefix}_${++idCounter}_${Date.now()}`;
}

export function generateEmail(): string {
  return `test_${generateId()}@example.com`;
}

export function generateUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: generateId('user'),
    email: generateEmail(),
    name: `Test User ${idCounter}`,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: null,
    ...overrides,
  };
}

export function generateCircle(overrides: Partial<MockCircle> = {}): MockCircle {
  return {
    id: generateId('circle'),
    name: `Test Circle ${idCounter}`,
    slug: `test-circle-${idCounter}`,
    description: 'A test circle for testing purposes',
    image: null,
    isPublic: true,
    creatorId: generateId('user'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function generateMembership(
  overrides: Partial<MockMembership> = {}
): MockMembership {
  return {
    id: generateId('membership'),
    circleId: generateId('circle'),
    name: `Test Tier ${idCounter}`,
    description: 'A test membership tier',
    price: 10000,
    benefits: ['Benefit 1', 'Benefit 2'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function generatePost(overrides: Partial<MockPost> = {}): MockPost {
  return {
    id: generateId('post'),
    circleId: generateId('circle'),
    authorId: generateId('user'),
    title: `Test Post ${idCounter}`,
    content: 'This is test content for the post.',
    isPublic: false,
    minTier: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Type Definitions
// =============================================================================

export interface MockUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: Date | null;
}

export interface MockCircle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  isPublic: boolean;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockMembership {
  id: string;
  circleId: string;
  name: string;
  description: string | null;
  price: number;
  benefits: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockPost {
  id: string;
  circleId: string;
  authorId: string;
  title: string;
  content: string;
  isPublic: boolean;
  minTier: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Assertion Helpers
// =============================================================================

export function expectToBeCloseToNow(date: Date, toleranceMs = 1000): void {
  const now = Date.now();
  const dateMs = date.getTime();
  expect(Math.abs(now - dateMs)).toBeLessThan(toleranceMs);
}

export function expectValidationError(
  response: { errors?: Array<{ field: string; message: string }> },
  field: string
): void {
  expect(response.errors).toBeDefined();
  expect(response.errors?.some((e) => e.field === field)).toBe(true);
}

// =============================================================================
// Exports
// =============================================================================

export { customRender as render };
export * from '@testing-library/react';
export { userEvent };
