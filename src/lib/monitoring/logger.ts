/**
 * Structured Logging with Pino
 * Netflix/Spotify-grade logging infrastructure
 */

import { randomUUID } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  circleId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  time: number;
  msg: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  [key: string]: unknown;
}

export interface LoggerConfig {
  level: LogLevel;
  pretty: boolean;
  redactPaths: string[];
  destination?: 'stdout' | 'file';
  filePath?: string;
}

// =============================================================================
// Log Level Priorities
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

// =============================================================================
// Sensitive Data Redaction
// =============================================================================

const DEFAULT_REDACT_PATHS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'ssn',
  'socialSecurityNumber',
];

function redactSensitiveData(
  obj: Record<string, unknown>,
  redactPaths: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = redactPaths.some(
      (path) =>
        lowerKey.includes(path.toLowerCase()) ||
        lowerKey === path.toLowerCase()
    );

    if (shouldRedact) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveData(
        value as Record<string, unknown>,
        redactPaths
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

// =============================================================================
// Pretty Formatter (Development)
// =============================================================================

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: '\x1b[90m', // Gray
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  fatal: '\x1b[35m', // Magenta
};

const RESET = '\x1b[0m';

function formatPretty(entry: LogEntry): string {
  const color = LEVEL_COLORS[entry.level];
  const time = new Date(entry.time).toISOString();
  const level = entry.level.toUpperCase().padEnd(5);

  let output = `${color}[${time}] ${level}${RESET} ${entry.msg}`;

  if (entry.context?.requestId) {
    output += ` ${'\x1b[90m'}(${entry.context.requestId})${RESET}`;
  }

  if (entry.duration !== undefined) {
    output += ` ${'\x1b[90m'}${entry.duration}ms${RESET}`;
  }

  if (entry.error) {
    output += `\n  ${'\x1b[31m'}Error: ${entry.error.message}${RESET}`;
    if (entry.error.stack) {
      const stackLines = entry.error.stack.split('\n').slice(1, 4);
      output += `\n${'\x1b[90m'}${stackLines.join('\n')}${RESET}`;
    }
  }

  // Additional context
  const contextKeys = Object.keys(entry).filter(
    (k) => !['level', 'time', 'msg', 'context', 'error', 'duration'].includes(k)
  );
  if (contextKeys.length > 0) {
    const contextData = contextKeys.reduce(
      (acc, k) => ({ ...acc, [k]: entry[k] }),
      {}
    );
    output += `\n  ${'\x1b[90m'}${JSON.stringify(contextData)}${RESET}`;
  }

  return output;
}

// =============================================================================
// Logger Class
// =============================================================================

export class Logger {
  private config: LoggerConfig;
  private context: LogContext;
  private static instance: Logger;

  constructor(config?: Partial<LoggerConfig>, context?: LogContext) {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      pretty: process.env.NODE_ENV !== 'production',
      redactPaths: DEFAULT_REDACT_PATHS,
      destination: 'stdout',
      ...config,
    };
    this.context = context || {};
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  child(context: LogContext): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Redact sensitive data
    const safeEntry = redactSensitiveData(
      entry as unknown as Record<string, unknown>,
      this.config.redactPaths
    ) as unknown as LogEntry;

    if (this.config.pretty) {
      console.log(formatPretty(safeEntry));
    } else {
      // JSON format for production (ELK, CloudWatch, etc.)
      console.log(JSON.stringify(safeEntry));
    }
  }

  private log(
    level: LogLevel,
    msg: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      time: Date.now(),
      msg,
      context: this.context,
      ...data,
    };

    this.write(entry);
  }

  trace(msg: string, data?: Record<string, unknown>): void {
    this.log('trace', msg, data);
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log('debug', msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log('info', msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log('warn', msg, data);
  }

  error(msg: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData: LogEntry['error'] = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as Error & { code?: string }).code,
        }
      : error
        ? { name: 'Unknown', message: String(error) }
        : undefined;

    this.log('error', msg, { ...data, error: errorData });
  }

  fatal(msg: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData: LogEntry['error'] = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as Error & { code?: string }).code,
        }
      : error
        ? { name: 'Unknown', message: String(error) }
        : undefined;

    this.log('fatal', msg, { ...data, error: errorData });
  }
}

// =============================================================================
// Request Logger Middleware
// =============================================================================

export interface RequestLogData {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

export function createRequestLogger(requestData: RequestLogData): Logger {
  const requestId = randomUUID();
  const traceId = randomUUID();

  return Logger.getInstance().child({
    requestId,
    traceId,
    ...requestData,
  });
}

// =============================================================================
// Performance Logger
// =============================================================================

export class PerformanceLogger {
  private logger: Logger;
  private timers: Map<string, number> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  start(operation: string): void {
    this.timers.set(operation, performance.now());
  }

  end(operation: string, data?: Record<string, unknown>): void {
    const startTime = this.timers.get(operation);
    if (startTime === undefined) {
      this.logger.warn(`No timer found for operation: ${operation}`);
      return;
    }

    const duration = Math.round(performance.now() - startTime);
    this.timers.delete(operation);

    this.logger.info(`${operation} completed`, { duration, ...data });

    // Slow operation warning
    if (duration > 1000) {
      this.logger.warn(`Slow operation detected: ${operation}`, {
        duration,
        threshold: 1000,
      });
    }
  }

  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    data?: Record<string, unknown>
  ): Promise<T> {
    this.start(operation);
    try {
      const result = await fn();
      this.end(operation, { ...data, success: true });
      return result;
    } catch (error) {
      const duration = Math.round(
        performance.now() - (this.timers.get(operation) || 0)
      );
      this.timers.delete(operation);
      this.logger.error(`${operation} failed`, error, { duration, ...data });
      throw error;
    }
  }
}

// =============================================================================
// Audit Logger (Compliance)
// =============================================================================

export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PERMISSION_CHANGE'
  | 'PAYMENT'
  | 'EXPORT';

export interface AuditLogEntry {
  timestamp: number;
  action: AuditAction;
  actor: {
    userId?: string;
    ip?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id?: string;
  };
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  result: 'SUCCESS' | 'FAILURE';
  reason?: string;
}

export class AuditLogger {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance().child({ type: 'audit' });
  }

  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    // Always log audit entries regardless of log level
    console.log(JSON.stringify({ ...fullEntry, level: 'audit' }));
  }

  logAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    result: 'SUCCESS' | 'FAILURE'
  ): void {
    this.log({
      action: 'READ',
      actor: { userId },
      resource: { type: resourceType, id: resourceId },
      result,
    });
  }

  logModification(
    userId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resourceType: string,
    resourceId: string,
    changes?: AuditLogEntry['changes']
  ): void {
    this.log({
      action,
      actor: { userId },
      resource: { type: resourceType, id: resourceId },
      changes,
      result: 'SUCCESS',
    });
  }

  logPayment(
    userId: string,
    transactionId: string,
    amount: number,
    result: 'SUCCESS' | 'FAILURE',
    reason?: string
  ): void {
    this.log({
      action: 'PAYMENT',
      actor: { userId },
      resource: { type: 'transaction', id: transactionId },
      changes: { after: { amount } },
      result,
      reason,
    });
  }
}

// =============================================================================
// Exports
// =============================================================================

export const logger = Logger.getInstance();
export const auditLogger = new AuditLogger();
