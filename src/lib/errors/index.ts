/**
 * CreatorCircle - Unified Error System
 *
 * Netflix/Stripe 수준의 에러 처리 시스템
 * - 일관된 에러 형식
 * - 상세한 에러 코드
 * - 운영 친화적 (로깅, 모니터링 연동)
 */

// ============================================
// Base Error Class
// ============================================

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);

    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();

    // Error.captureStackTrace가 있는 환경에서만 사용
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // 프로토타입 체인 유지
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        context: this.context,
      }),
    };
  }

  // 사용자에게 보여줄 안전한 메시지
  toUserMessage(): string {
    return this.isOperational ? this.message : '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

// ============================================
// Client Errors (4xx)
// ============================================

export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(
    message: string,
    errors?: Record<string, string[]>,
    context?: Record<string, unknown>
  ) {
    super('VALIDATION_ERROR', message, 400, true, context);
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = '인증이 필요합니다') {
    super('UNAUTHORIZED', message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = '접근 권한이 없습니다') {
    super('FORBIDDEN', message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = '리소스') {
    super('NOT_FOUND', `${resource}을(를) 찾을 수 없습니다`, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409, true);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      'RATE_LIMIT_EXCEEDED',
      '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      429,
      true,
      { retryAfter }
    );
    this.retryAfter = retryAfter;
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(maxSize: string = '10MB') {
    super('PAYLOAD_TOO_LARGE', `요청 크기가 ${maxSize}를 초과했습니다`, 413, true);
  }
}

// ============================================
// Server Errors (5xx)
// ============================================

export class InternalServerError extends AppError {
  constructor(message: string = '내부 서버 오류가 발생했습니다', context?: Record<string, unknown>) {
    super('INTERNAL_SERVER_ERROR', message, 500, false, context);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string = '서비스') {
    super('SERVICE_UNAVAILABLE', `${service}에 일시적인 문제가 발생했습니다`, 503, true);
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(service: string = '외부 서비스') {
    super('GATEWAY_TIMEOUT', `${service} 응답 시간이 초과되었습니다`, 504, true);
  }
}

// ============================================
// Domain-Specific Errors
// ============================================

// 인증 관련
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다', 401, true);
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor() {
    super('EMAIL_NOT_VERIFIED', '이메일 인증이 필요합니다', 403, true);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('TOKEN_EXPIRED', '인증이 만료되었습니다. 다시 로그인해 주세요', 401, true);
  }
}

export class AccountSuspendedError extends AppError {
  constructor() {
    super('ACCOUNT_SUSPENDED', '계정이 정지되었습니다. 고객센터에 문의해 주세요', 403, true);
  }
}

// 결제 관련
export class PaymentFailedError extends AppError {
  public readonly paymentIntentId?: string;

  constructor(message: string = '결제에 실패했습니다', paymentIntentId?: string) {
    super('PAYMENT_FAILED', message, 402, true, { paymentIntentId });
    this.paymentIntentId = paymentIntentId;
  }
}

export class InsufficientFundsError extends AppError {
  constructor() {
    super('INSUFFICIENT_FUNDS', '잔액이 부족합니다', 402, true);
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(requiredTier?: string) {
    super(
      'SUBSCRIPTION_REQUIRED',
      requiredTier
        ? `이 콘텐츠를 보려면 ${requiredTier} 구독이 필요합니다`
        : '이 콘텐츠를 보려면 구독이 필요합니다',
      403,
      true,
      { requiredTier }
    );
  }
}

// 서클/콘텐츠 관련
export class CircleNotFoundError extends NotFoundError {
  constructor(identifier?: string) {
    super(identifier ? `서클 (${identifier})` : '서클');
    this.code = 'CIRCLE_NOT_FOUND';
  }
}

export class PostNotFoundError extends NotFoundError {
  constructor(identifier?: string) {
    super(identifier ? `게시물 (${identifier})` : '게시물');
    this.code = 'POST_NOT_FOUND';
  }
}

export class MembershipRequiredError extends AppError {
  constructor(circleSlug?: string) {
    super(
      'MEMBERSHIP_REQUIRED',
      '이 서클의 멤버만 접근할 수 있습니다',
      403,
      true,
      { circleSlug }
    );
  }
}

// 크리에이터 관련
export class CreatorVerificationRequiredError extends AppError {
  constructor() {
    super('CREATOR_VERIFICATION_REQUIRED', '크리에이터 인증이 필요합니다', 403, true);
  }
}

export class CreatorApplicationPendingError extends AppError {
  constructor() {
    super('CREATOR_APPLICATION_PENDING', '크리에이터 신청이 검토 중입니다', 403, true);
  }
}

// 외부 서비스 관련
export class StripeError extends AppError {
  public readonly stripeCode?: string;

  constructor(message: string, stripeCode?: string, context?: Record<string, unknown>) {
    super('STRIPE_ERROR', message, 502, true, context);
    this.stripeCode = stripeCode;
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, context?: Record<string, unknown>) {
    super('DATABASE_ERROR', `데이터베이스 ${operation} 중 오류가 발생했습니다`, 500, false, context);
  }
}

export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(serviceName: string, message?: string, context?: Record<string, unknown>) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      message || `${serviceName} 서비스 연결에 실패했습니다`,
      502,
      true,
      context
    );
    this.serviceName = serviceName;
  }
}

// ============================================
// Error Utilities
// ============================================

/**
 * 에러가 AppError 인스턴스인지 확인
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 에러가 운영 에러인지 확인 (재시도 가능)
 */
export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * 알 수 없는 에러를 AppError로 변환
 */
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, { originalError: error.name });
  }

  return new InternalServerError('알 수 없는 오류가 발생했습니다');
}

/**
 * API 응답용 에러 형식화
 */
export function formatErrorResponse(error: AppError) {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.toUserMessage(),
      ...(error instanceof ValidationError && error.errors && {
        errors: error.errors,
      }),
      ...(error instanceof RateLimitError && {
        retryAfter: error.retryAfter,
      }),
    },
  };
}

/**
 * HTTP 상태 코드로 에러 생성
 */
export function createErrorFromStatus(status: number, message?: string): AppError {
  switch (status) {
    case 400:
      return new ValidationError(message || '잘못된 요청입니다');
    case 401:
      return new UnauthorizedError(message);
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message || '리소스');
    case 409:
      return new ConflictError(message || '충돌이 발생했습니다');
    case 429:
      return new RateLimitError();
    case 500:
      return new InternalServerError(message);
    case 502:
      return new ExternalServiceError('외부 서비스');
    case 503:
      return new ServiceUnavailableError();
    case 504:
      return new GatewayTimeoutError();
    default:
      return new AppError('UNKNOWN_ERROR', message || '오류가 발생했습니다', status);
  }
}
