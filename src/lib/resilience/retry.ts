/**
 * Retry Logic with Exponential Backoff
 *
 * Spotify/AWS 스타일의 재시도 로직
 * - Exponential Backoff
 * - Jitter (동시 재시도 충돌 방지)
 * - 재시도 가능 에러 판별
 */

import { AppError, isAppError, GatewayTimeoutError, ServiceUnavailableError } from '../errors';

// ============================================
// Types
// ============================================

export interface RetryConfig {
  /** 최대 재시도 횟수 - 기본 3 */
  retries: number;
  /** 백오프 전략 */
  backoff: 'linear' | 'exponential' | 'fixed';
  /** 초기 대기 시간 (ms) - 기본 1000 */
  initialDelay: number;
  /** 최대 대기 시간 (ms) - 기본 30000 */
  maxDelay: number;
  /** Jitter 활성화 여부 - 기본 true */
  jitter: boolean;
  /** 재시도 가능 에러 코드 */
  retryableErrors?: string[];
  /** 재시도 가능 HTTP 상태 코드 */
  retryableStatuses?: number[];
  /** 재시도 전 콜백 */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN',
  'GATEWAY_TIMEOUT',
  'SERVICE_UNAVAILABLE',
];

const DEFAULT_RETRYABLE_STATUSES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

const DEFAULT_CONFIG: RetryConfig = {
  retries: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  retryableErrors: DEFAULT_RETRYABLE_ERRORS,
  retryableStatuses: DEFAULT_RETRYABLE_STATUSES,
};

// ============================================
// Utility Functions
// ============================================

/**
 * 지정된 시간만큼 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 에러가 재시도 가능한지 판별
 */
function isRetryable(
  error: unknown,
  retryableErrors: string[],
  retryableStatuses: number[]
): boolean {
  // AppError인 경우
  if (isAppError(error)) {
    // 운영 에러가 아니면 재시도 불가 (프로그래밍 에러)
    if (!error.isOperational) {
      return false;
    }

    // 에러 코드 확인
    if (retryableErrors.includes(error.code)) {
      return true;
    }

    // HTTP 상태 코드 확인
    if (retryableStatuses.includes(error.statusCode)) {
      return true;
    }

    return false;
  }

  // 일반 Error인 경우
  if (error instanceof Error) {
    // 네트워크 에러 메시지 패턴
    const networkErrorPatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'fetch failed',
      'network',
      'timeout',
    ];

    return networkErrorPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  return false;
}

/**
 * 대기 시간 계산
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  let delay: number;

  switch (config.backoff) {
    case 'exponential':
      // 2^attempt * initialDelay
      delay = Math.pow(2, attempt) * config.initialDelay;
      break;
    case 'linear':
      // (attempt + 1) * initialDelay
      delay = (attempt + 1) * config.initialDelay;
      break;
    case 'fixed':
    default:
      delay = config.initialDelay;
  }

  // Jitter 추가 (0-25% 랜덤 추가)
  if (config.jitter) {
    const jitterRange = delay * 0.25;
    delay += Math.random() * jitterRange;
  }

  // 최대 대기 시간 제한
  return Math.min(delay, config.maxDelay);
}

// ============================================
// Main Retry Function
// ============================================

/**
 * 재시도 로직으로 함수 실행
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { retries: 3, backoff: 'exponential' }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const mergedConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= mergedConfig.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 마지막 시도거나 재시도 불가능한 에러면 즉시 throw
      const canRetry = isRetryable(
        error,
        mergedConfig.retryableErrors!,
        mergedConfig.retryableStatuses!
      );

      if (attempt >= mergedConfig.retries || !canRetry) {
        throw lastError;
      }

      // 대기 시간 계산
      const delay = calculateDelay(attempt, mergedConfig);

      // 콜백 호출
      if (mergedConfig.onRetry) {
        mergedConfig.onRetry(lastError, attempt + 1, delay);
      }

      // 로깅
      console.warn(
        `[Retry] Attempt ${attempt + 1}/${mergedConfig.retries} failed, ` +
        `retrying in ${Math.round(delay)}ms: ${lastError.message}`
      );

      // 대기
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 재시도 로직으로 함수 실행 (결과 객체 반환)
 * 에러를 throw하지 않고 결과 객체로 반환
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const data = await withRetry(fn, {
      ...config,
      onRetry: (error, attempt, delay) => {
        attempts = attempt;
        config.onRetry?.(error, attempt, delay);
      },
    });

    return {
      success: true,
      data,
      attempts: attempts + 1,
      totalTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: attempts + 1,
      totalTime: Date.now() - startTime,
    };
  }
}

// ============================================
// Specialized Retry Functions
// ============================================

/**
 * 데이터베이스 작업용 재시도
 */
export async function retryDatabaseOperation<T>(
  fn: () => Promise<T>
): Promise<T> {
  return withRetry(fn, {
    retries: 3,
    backoff: 'exponential',
    initialDelay: 100,
    maxDelay: 2000,
    retryableErrors: [
      'P1001', // Prisma: Can't reach database server
      'P1002', // Prisma: Database server timeout
      'P1008', // Prisma: Operations timed out
      'P1017', // Prisma: Server has closed the connection
      'ECONNRESET',
      'ETIMEDOUT',
    ],
    onRetry: (error, attempt, delay) => {
      console.warn(`[DB Retry] Attempt ${attempt}: ${error.message}`);
    },
  });
}

/**
 * Stripe API 호출용 재시도
 */
export async function retryStripeOperation<T>(
  fn: () => Promise<T>
): Promise<T> {
  return withRetry(fn, {
    retries: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
    retryableStatuses: [429, 500, 502, 503, 504],
    onRetry: (error, attempt, delay) => {
      console.warn(`[Stripe Retry] Attempt ${attempt}: ${error.message}`);
    },
  });
}

/**
 * 외부 API 호출용 재시도
 */
export async function retryExternalApi<T>(
  fn: () => Promise<T>,
  serviceName: string = 'ExternalAPI'
): Promise<T> {
  return withRetry(fn, {
    retries: 3,
    backoff: 'exponential',
    initialDelay: 500,
    maxDelay: 5000,
    onRetry: (error, attempt, delay) => {
      console.warn(`[${serviceName} Retry] Attempt ${attempt}: ${error.message}`);
    },
  });
}

/**
 * 이메일 발송용 재시도
 */
export async function retryEmailSend<T>(
  fn: () => Promise<T>
): Promise<T> {
  return withRetry(fn, {
    retries: 3,
    backoff: 'linear',
    initialDelay: 2000,
    maxDelay: 10000,
    onRetry: (error, attempt, delay) => {
      console.warn(`[Email Retry] Attempt ${attempt}: ${error.message}`);
    },
  });
}

// ============================================
// Retry with Circuit Breaker
// ============================================

import { CircuitBreaker } from './circuit-breaker';

/**
 * Circuit Breaker + Retry 조합
 * 외부 서비스 호출 시 권장
 */
export async function withCircuitBreakerAndRetry<T>(
  fn: () => Promise<T>,
  circuit: CircuitBreaker,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  return circuit.fire(() => withRetry(fn, retryConfig));
}
