/**
 * Sentry Error Tracking Integration
 * Production-grade error monitoring with context enrichment
 */

import { logger } from './logger';

// =============================================================================
// Types
// =============================================================================

export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}

export interface SentryContext {
  [key: string]: Record<string, unknown>;
}

export interface SentryTag {
  [key: string]: string;
}

export interface SentryBreadcrumb {
  type?: string;
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  level?: SeverityLevel;
  timestamp?: number;
}

export interface SentryEvent {
  event_id: string;
  timestamp: number;
  level: SeverityLevel;
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
          colno: number;
        }>;
      };
    }>;
  };
  user?: SentryUser;
  tags?: SentryTag;
  contexts?: SentryContext;
  breadcrumbs?: SentryBreadcrumb[];
  environment?: string;
  release?: string;
  transaction?: string;
}

export interface SentryConfig {
  dsn?: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  maxBreadcrumbs: number;
  beforeSend?: (event: SentryEvent) => SentryEvent | null;
}

// =============================================================================
// Sensitive Data Scrubbing
// =============================================================================

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
];

function scrubSensitiveData(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((k) =>
      lowerKey.includes(k.toLowerCase())
    );

    if (isSensitive) {
      result[key] = '[Filtered]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = scrubSensitiveData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// =============================================================================
// Stack Trace Parser
// =============================================================================

interface StackFrame {
  filename: string;
  function: string;
  lineno: number;
  colno: number;
}

function parseStackTrace(stack?: string): StackFrame[] {
  if (!stack) return [];

  const frames: StackFrame[] = [];
  const lines = stack.split('\n').slice(1); // Skip error message line

  for (const line of lines) {
    // Match patterns like "at functionName (filename:line:col)"
    const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
    if (match) {
      frames.push({
        function: match[1],
        filename: match[2],
        lineno: parseInt(match[3], 10),
        colno: parseInt(match[4], 10),
      });
    } else {
      // Match patterns like "at filename:line:col"
      const simpleMatch = line.match(/at\s+(.+):(\d+):(\d+)/);
      if (simpleMatch) {
        frames.push({
          function: '<anonymous>',
          filename: simpleMatch[1],
          lineno: parseInt(simpleMatch[2], 10),
          colno: parseInt(simpleMatch[3], 10),
        });
      }
    }
  }

  return frames.reverse(); // Sentry expects frames in reverse order
}

// =============================================================================
// Sentry Client
// =============================================================================

export class SentryClient {
  private config: SentryConfig;
  private breadcrumbs: SentryBreadcrumb[] = [];
  private user?: SentryUser;
  private tags: SentryTag = {};
  private contexts: SentryContext = {};
  private static instance: SentryClient;

  constructor(config?: Partial<SentryConfig>) {
    this.config = {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.NEXT_PUBLIC_VERSION,
      sampleRate: 1.0,
      tracesSampleRate: 0.1,
      maxBreadcrumbs: 100,
      ...config,
    };
  }

  static getInstance(): SentryClient {
    if (!SentryClient.instance) {
      SentryClient.instance = new SentryClient();
    }
    return SentryClient.instance;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  setUser(user: SentryUser | null): void {
    this.user = user || undefined;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setTags(tags: SentryTag): void {
    this.tags = { ...this.tags, ...tags };
  }

  setContext(name: string, context: Record<string, unknown>): void {
    this.contexts[name] = context;
  }

  // ===========================================================================
  // Breadcrumbs
  // ===========================================================================

  addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now(),
    });

    // Keep only the most recent breadcrumbs
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs);
    }
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  // ===========================================================================
  // Error Capture
  // ===========================================================================

  captureException(
    error: Error,
    context?: {
      tags?: SentryTag;
      contexts?: SentryContext;
      level?: SeverityLevel;
      transaction?: string;
    }
  ): string {
    // Sample rate check
    if (Math.random() > this.config.sampleRate) {
      return '';
    }

    const eventId = this.generateEventId();
    const event = this.buildEvent(error, context);

    // Apply beforeSend hook
    if (this.config.beforeSend) {
      const modifiedEvent = this.config.beforeSend(event);
      if (!modifiedEvent) {
        return ''; // Event was dropped
      }
    }

    // Send to Sentry
    this.sendEvent(event);

    // Also log locally
    logger.error(`[Sentry] Captured exception: ${error.message}`, error, {
      eventId,
      tags: event.tags,
    });

    return eventId;
  }

  captureMessage(
    message: string,
    level: SeverityLevel = 'info',
    context?: {
      tags?: SentryTag;
      contexts?: SentryContext;
    }
  ): string {
    const eventId = this.generateEventId();
    const event: SentryEvent = {
      event_id: eventId,
      timestamp: Date.now(),
      level,
      message,
      user: this.user,
      tags: { ...this.tags, ...context?.tags },
      contexts: { ...this.contexts, ...context?.contexts },
      breadcrumbs: [...this.breadcrumbs],
      environment: this.config.environment,
      release: this.config.release,
    };

    this.sendEvent(event);

    logger.info(`[Sentry] Captured message: ${message}`, { eventId, level });

    return eventId;
  }

  // ===========================================================================
  // Transaction Tracing
  // ===========================================================================

  startTransaction(name: string, op: string): SentryTransaction {
    return new SentryTransaction(this, name, op);
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  private generateEventId(): string {
    return [...Array(32)]
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('');
  }

  private buildEvent(
    error: Error,
    context?: {
      tags?: SentryTag;
      contexts?: SentryContext;
      level?: SeverityLevel;
      transaction?: string;
    }
  ): SentryEvent {
    return {
      event_id: this.generateEventId(),
      timestamp: Date.now(),
      level: context?.level || 'error',
      exception: {
        values: [
          {
            type: error.name,
            value: error.message,
            stacktrace: {
              frames: parseStackTrace(error.stack),
            },
          },
        ],
      },
      user: this.user,
      tags: scrubSensitiveData({
        ...this.tags,
        ...context?.tags,
      }) as SentryTag,
      contexts: scrubSensitiveData({
        ...this.contexts,
        ...context?.contexts,
      }) as SentryContext,
      breadcrumbs: [...this.breadcrumbs],
      environment: this.config.environment,
      release: this.config.release,
      transaction: context?.transaction,
    };
  }

  private async sendEvent(event: SentryEvent): Promise<void> {
    if (!this.config.dsn) {
      // Development mode - just log
      if (process.env.NODE_ENV === 'development') {
        console.log('[Sentry Mock]', JSON.stringify(event, null, 2));
      }
      return;
    }

    try {
      // In production, this would POST to Sentry API
      // const response = await fetch(this.config.dsn, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event),
      // });

      // For now, we'll simulate the send
      logger.debug('[Sentry] Event sent', { eventId: event.event_id });
    } catch (sendError) {
      logger.error('[Sentry] Failed to send event', sendError);
    }
  }
}

// =============================================================================
// Transaction for Performance Monitoring
// =============================================================================

export class SentryTransaction {
  private client: SentryClient;
  private name: string;
  private op: string;
  private startTime: number;
  private spans: SentrySpan[] = [];
  private status: 'ok' | 'error' | 'cancelled' = 'ok';

  constructor(client: SentryClient, name: string, op: string) {
    this.client = client;
    this.name = name;
    this.op = op;
    this.startTime = performance.now();
  }

  startSpan(op: string, description: string): SentrySpan {
    const span = new SentrySpan(op, description);
    this.spans.push(span);
    return span;
  }

  setStatus(status: 'ok' | 'error' | 'cancelled'): void {
    this.status = status;
  }

  finish(): void {
    const duration = performance.now() - this.startTime;

    logger.info(`[Sentry] Transaction finished: ${this.name}`, {
      op: this.op,
      duration: Math.round(duration),
      status: this.status,
      spanCount: this.spans.length,
    });

    // Send transaction to Sentry
    this.client.addBreadcrumb({
      type: 'transaction',
      category: this.op,
      message: this.name,
      data: {
        duration,
        status: this.status,
        spans: this.spans.map((s) => s.toJSON()),
      },
      level: this.status === 'ok' ? 'info' : 'error',
    });
  }
}

export class SentrySpan {
  private op: string;
  private description: string;
  private startTime: number;
  private endTime?: number;
  private status: 'ok' | 'error' = 'ok';
  private data: Record<string, unknown> = {};

  constructor(op: string, description: string) {
    this.op = op;
    this.description = description;
    this.startTime = performance.now();
  }

  setData(key: string, value: unknown): void {
    this.data[key] = value;
  }

  setStatus(status: 'ok' | 'error'): void {
    this.status = status;
  }

  finish(): void {
    this.endTime = performance.now();
  }

  toJSON(): Record<string, unknown> {
    return {
      op: this.op,
      description: this.description,
      duration: this.endTime
        ? Math.round(this.endTime - this.startTime)
        : undefined,
      status: this.status,
      data: this.data,
    };
  }
}

// =============================================================================
// Error Boundary Helper
// =============================================================================

export function captureReactError(
  error: Error,
  errorInfo: { componentStack?: string }
): string {
  const sentry = SentryClient.getInstance();

  sentry.addBreadcrumb({
    type: 'error',
    category: 'react.error-boundary',
    message: error.message,
    data: { componentStack: errorInfo.componentStack },
    level: 'error',
  });

  return sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack,
      },
    },
  });
}

// =============================================================================
// API Error Wrapper
// =============================================================================

export function captureApiError(
  error: Error,
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): string {
  const sentry = SentryClient.getInstance();

  sentry.addBreadcrumb({
    type: 'http',
    category: 'api.error',
    message: `${request.method} ${request.url}`,
    data: scrubSensitiveData({
      method: request.method,
      url: request.url,
      headers: request.headers,
    }),
    level: 'error',
  });

  return sentry.captureException(error, {
    tags: {
      'api.method': request.method,
      'api.endpoint': new URL(request.url, 'http://localhost').pathname,
    },
    contexts: {
      request: scrubSensitiveData({
        method: request.method,
        url: request.url,
      }),
    },
  });
}

// =============================================================================
// Exports
// =============================================================================

export const sentry = SentryClient.getInstance();
