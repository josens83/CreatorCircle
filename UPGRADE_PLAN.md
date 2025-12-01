# CreatorCircle 엔터프라이즈급 고도화 계획

> **현재 상태:** 4.5/10 (프로덕션 미준비)
> **목표 상태:** 9/10 (Netflix/Spotify 수준)
> **예상 기간:** 8-12주

---

## 📊 현재 상태 진단 요약

| 카테고리 | 현재 점수 | 목표 점수 | 우선순위 |
|---------|----------|----------|---------|
| 에러 처리 & 복원력 | 5/10 | 9/10 | 🔴 Critical |
| 보안 | 5/10 | 9/10 | 🔴 Critical |
| Rate Limiting | 0/10 | 9/10 | 🔴 Critical |
| 결제 안정성 | 5/10 | 9/10 | 🔴 Critical |
| 테스팅 | 0/10 | 8/10 | 🔴 Critical |
| 모니터링 | 0/10 | 9/10 | 🔴 Critical |
| 로깅 | 3/10 | 8/10 | 🟡 High |
| 인증 | 6/10 | 9/10 | 🟡 High |
| 접근성 | 7/10 | 9/10 | 🟡 High |
| 성능 최적화 | 6/10 | 9/10 | 🟢 Medium |
| 확장성 | 5/10 | 8/10 | 🟢 Medium |

---

## 🎯 Phase 1: 에러 처리 및 복원력 (Netflix 수준)

> **기간:** 2주
> **벤치마크:** Netflix Circuit Breaker, Spotify Retry Patterns

### 1.1 통합 에러 처리 시스템

```typescript
// src/lib/errors/index.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public isOperational: boolean = true,
    public context?: Record<string, unknown>
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, true, context);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409, true);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests', 429, true, { retryAfter });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super('SERVICE_UNAVAILABLE', `${service} is temporarily unavailable`, 503, true);
  }
}
```

### 1.2 Circuit Breaker 구현 (Netflix Hystrix 패턴)

```typescript
// src/lib/resilience/circuit-breaker.ts
interface CircuitBreakerConfig {
  timeout: number;           // 요청 타임아웃 (ms)
  errorThreshold: number;    // 실패율 임계값 (%)
  volumeThreshold: number;   // 최소 요청 수
  resetTimeout: number;      // 회로 복구 대기 시간 (ms)
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      timeout: 3000,
      errorThreshold: 50,
      volumeThreshold: 10,
      resetTimeout: 30000,
      ...config
    };
  }

  async fire<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
      )
    ]);
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
    this.successes++;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    const totalRequests = this.failures + this.successes;
    const failureRate = (this.failures / totalRequests) * 100;

    if (totalRequests >= this.config.volumeThreshold &&
        failureRate >= this.config.errorThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }
}
```

### 1.3 재시도 로직 (Exponential Backoff)

```typescript
// src/lib/resilience/retry.ts
interface RetryConfig {
  retries: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  retryableErrors?: string[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const {
    retries = 3,
    backoff = 'exponential',
    initialDelay = 1000,
    maxDelay = 10000,
    retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
  } = config;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 재시도 불가능한 에러인지 확인
      if (!isRetryable(error, retryableErrors)) {
        throw error;
      }

      if (attempt < retries) {
        const delay = calculateDelay(attempt, backoff, initialDelay, maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

function calculateDelay(
  attempt: number,
  backoff: string,
  initialDelay: number,
  maxDelay: number
): number {
  let delay: number;

  if (backoff === 'exponential') {
    delay = initialDelay * Math.pow(2, attempt);
  } else {
    delay = initialDelay * (attempt + 1);
  }

  // Jitter 추가 (동시 재시도 방지)
  delay += Math.random() * 1000;

  return Math.min(delay, maxDelay);
}
```

### 1.4 Graceful Degradation & Fallback

```typescript
// src/lib/resilience/fallback.ts
export class FallbackService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly staleTTL = 5 * 60 * 1000; // 5분

  async withFallback<T>(
    key: string,
    primaryFn: () => Promise<T>,
    fallbackFn?: () => Promise<T> | T
  ): Promise<T> {
    try {
      const result = await primaryFn();
      this.cache.set(key, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      // 1. 캐시된 데이터 시도
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.staleTTL) {
        console.warn(`Using cached data for ${key}`);
        return cached.data as T;
      }

      // 2. 폴백 함수 시도
      if (fallbackFn) {
        console.warn(`Using fallback for ${key}`);
        return fallbackFn();
      }

      throw error;
    }
  }
}
```

### 1.5 React Error Boundary

```typescript
// src/components/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Sentry/로깅 서비스로 전송
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <h2 className="text-xl font-semibold mb-4">문제가 발생했습니다</h2>
          <p className="text-gray-600 mb-4">잠시 후 다시 시도해 주세요.</p>
          <Button onClick={() => this.setState({ hasError: false })}>
            다시 시도
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 체크리스트

- [ ] 통합 에러 클래스 시스템 구현
- [ ] Circuit Breaker 패턴 적용 (Stripe, 외부 API)
- [ ] Exponential Backoff 재시도 로직
- [ ] Graceful Degradation 전략
- [ ] 모든 API 라우트에 Error Boundary 적용
- [ ] 사용자 친화적 에러 메시지 정의
- [ ] 에러 복구 가이드 UI

---

## 🔒 Phase 2: 보안 강화 (은행 수준)

> **기간:** 2주
> **벤치마크:** Stripe Security, GitHub Security Headers

### 2.1 Security Headers Middleware

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.stripe.com wss:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 2.2 Rate Limiting

```typescript
// src/lib/security/rate-limiter.ts
import { Redis } from '@upstash/redis';

interface RateLimitConfig {
  windowMs: number;     // 윈도우 크기 (ms)
  max: number;          // 최대 요청 수
  keyPrefix?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = {
      keyPrefix: 'rl:',
      ...config
    };
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Sliding Window 알고리즘
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    pipeline.zcard(key);
    pipeline.pexpire(key, this.config.windowMs);

    const results = await pipeline.exec();
    const requestCount = results[2] as number;

    return {
      success: requestCount <= this.config.max,
      remaining: Math.max(0, this.config.max - requestCount),
      resetTime: now + this.config.windowMs
    };
  }

  // IP + User ID 복합 키 생성
  static getIdentifier(ip: string, userId?: string): string {
    return userId ? `user:${userId}` : `ip:${ip}`;
  }
}

// 미리 설정된 Rate Limiter 인스턴스
export const rateLimiters = {
  // 인증 API: 분당 5회
  auth: new RateLimiter(redis, { windowMs: 60000, max: 5, keyPrefix: 'rl:auth:' }),

  // 일반 API: 분당 100회
  api: new RateLimiter(redis, { windowMs: 60000, max: 100, keyPrefix: 'rl:api:' }),

  // 결제 API: 분당 10회
  payment: new RateLimiter(redis, { windowMs: 60000, max: 10, keyPrefix: 'rl:pay:' }),

  // 파일 업로드: 시간당 20회
  upload: new RateLimiter(redis, { windowMs: 3600000, max: 20, keyPrefix: 'rl:upload:' }),
};
```

### 2.3 입력 검증 및 Sanitization

```typescript
// src/lib/security/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// HTML Sanitization
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ADD_ATTR: ['target="_blank"', 'rel="noopener noreferrer"'],
  });
}

// SQL Injection 방지 (Prisma는 기본적으로 안전하지만 추가 검증)
export const safeString = z.string()
  .transform(s => s.trim())
  .refine(s => !/[<>'";\-\-\/\*]/.test(s), {
    message: 'Invalid characters detected'
  });

// 이메일 검증
export const emailSchema = z.string()
  .email()
  .toLowerCase()
  .max(255);

// 비밀번호 정책 (OWASP 기준)
export const passwordSchema = z.string()
  .min(12, '비밀번호는 최소 12자 이상이어야 합니다')
  .max(128)
  .regex(/[a-z]/, '소문자를 포함해야 합니다')
  .regex(/[A-Z]/, '대문자를 포함해야 합니다')
  .regex(/[0-9]/, '숫자를 포함해야 합니다')
  .regex(/[^a-zA-Z0-9]/, '특수문자를 포함해야 합니다')
  .refine(
    pwd => !commonPasswords.includes(pwd.toLowerCase()),
    '너무 일반적인 비밀번호입니다'
  );

// 파일 업로드 검증
export const fileUploadSchema = z.object({
  filename: z.string().max(255).regex(/^[a-zA-Z0-9._-]+$/),
  mimetype: z.enum([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'video/mp4'
  ]),
  size: z.number().max(50 * 1024 * 1024), // 50MB
});
```

### 2.4 감사 로그 (Audit Trail)

```typescript
// src/lib/security/audit.ts
export interface AuditEvent {
  id: string;
  timestamp: Date;
  action: string;
  category: 'AUTH' | 'PAYMENT' | 'CONTENT' | 'ADMIN' | 'SECURITY';
  userId?: string;
  ip: string;
  userAgent: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class AuditLogger {
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    // DB에 저장
    await prisma.auditLog.create({
      data: auditEvent
    });

    // 중요 이벤트는 실시간 알림
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      await this.alertSecurityTeam(auditEvent);
    }
  }

  // 미리 정의된 이벤트 타입
  async logLoginSuccess(userId: string, ip: string, userAgent: string) {
    await this.log({
      action: 'LOGIN_SUCCESS',
      category: 'AUTH',
      userId,
      ip,
      userAgent,
      severity: 'LOW'
    });
  }

  async logLoginFailure(email: string, ip: string, userAgent: string, reason: string) {
    await this.log({
      action: 'LOGIN_FAILURE',
      category: 'AUTH',
      ip,
      userAgent,
      details: { email: this.maskEmail(email), reason },
      severity: 'MEDIUM'
    });
  }

  async logPaymentAttempt(userId: string, amount: number, ip: string, userAgent: string) {
    await this.log({
      action: 'PAYMENT_ATTEMPT',
      category: 'PAYMENT',
      userId,
      ip,
      userAgent,
      details: { amount },
      severity: 'HIGH'
    });
  }

  async logUnauthorizedAccess(ip: string, userAgent: string, resource: string) {
    await this.log({
      action: 'UNAUTHORIZED_ACCESS',
      category: 'SECURITY',
      ip,
      userAgent,
      resource,
      severity: 'CRITICAL'
    });
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private async alertSecurityTeam(event: AuditEvent): Promise<void> {
    // Slack, PagerDuty 등으로 알림
  }
}

export const audit = new AuditLogger();
```

### 2.5 이메일 인증 플로우

```typescript
// src/lib/auth/email-verification.ts
import { randomBytes } from 'crypto';
import { addHours } from 'date-fns';

export class EmailVerificationService {
  async createVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expires = addHours(new Date(), 24); // 24시간 유효

    await prisma.verificationToken.create({
      data: {
        identifier: userId,
        token,
        expires,
      },
    });

    return token;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const verification = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verification || verification.expires < new Date()) {
      return false;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verification.identifier },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: { token },
      }),
    ]);

    return true;
  }
}
```

### 체크리스트

- [ ] Security Headers Middleware 적용
- [ ] CSP (Content Security Policy) 구성
- [ ] Rate Limiting 전체 API 적용
- [ ] Input Sanitization 모든 입력에 적용
- [ ] 감사 로그 시스템 구현
- [ ] 이메일 인증 플로우
- [ ] 비밀번호 재설정 플로우
- [ ] 2FA/MFA 옵션 추가
- [ ] 세션 관리 (디바이스별 로그아웃)
- [ ] SQL Injection 테스트
- [ ] XSS 테스트
- [ ] CSRF 보호 검증

---

## 💳 Phase 3: 결제 안정성 강화 (Stripe 수준)

> **기간:** 2주
> **벤치마크:** Stripe Reliability, PayPal Transaction Safety

### 3.1 Webhook Idempotency

```typescript
// src/lib/payments/webhook-handler.ts
import Stripe from 'stripe';

export class StripeWebhookHandler {
  async handleEvent(event: Stripe.Event): Promise<void> {
    // 1. 멱등성 체크
    const processed = await prisma.processedWebhook.findUnique({
      where: { eventId: event.id }
    });

    if (processed) {
      console.log(`Webhook ${event.id} already processed, skipping`);
      return;
    }

    // 2. 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      // 처리 기록
      await tx.processedWebhook.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          processedAt: new Date(),
        }
      });

      // 이벤트 처리
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object, tx);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object, tx);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object, tx);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object, tx);
          break;
        case 'charge.refunded':
          await this.handleRefund(event.data.object, tx);
          break;
        case 'charge.dispute.created':
          await this.handleDispute(event.data.object, tx);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    }, {
      maxWait: 10000,
      timeout: 30000,
    });
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
    tx: PrismaTransaction
  ): Promise<void> {
    const { circleId, userId, tierId, referralCode } = session.metadata!;

    // 멤버십 생성
    await tx.member.create({
      data: {
        circleId,
        userId,
        tierId,
        status: 'ACTIVE',
        joinedAt: new Date(),
      }
    });

    // 서클 멤버 수 증가
    await tx.circle.update({
      where: { id: circleId },
      data: { memberCount: { increment: 1 } }
    });

    // 구독 기록
    await tx.subscription.create({
      data: {
        userId,
        circleId,
        tierId,
        stripeSubscriptionId: session.subscription as string,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(tierId),
      }
    });

    // 레퍼럴 처리
    if (referralCode) {
      await this.processReferral(referralCode, session.amount_total!, tx);
    }
  }
}
```

### 3.2 결제 금액 정밀 계산

```typescript
// src/lib/payments/calculations.ts
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class PaymentCalculator {
  // 플랫폼 수수료: 10%
  static readonly PLATFORM_FEE_RATE = new Decimal('0.10');

  // Stripe 수수료: 2.9% + 30원
  static readonly STRIPE_FEE_RATE = new Decimal('0.029');
  static readonly STRIPE_FEE_FIXED = new Decimal('30');

  static calculateCreatorEarnings(grossAmount: number): {
    gross: string;
    stripeFee: string;
    platformFee: string;
    creatorEarnings: string;
  } {
    const gross = new Decimal(grossAmount);

    // Stripe 수수료 계산
    const stripeFee = gross.mul(this.STRIPE_FEE_RATE).plus(this.STRIPE_FEE_FIXED);

    // 플랫폼 수수료 계산 (Stripe 수수료 제외 후)
    const afterStripe = gross.minus(stripeFee);
    const platformFee = afterStripe.mul(this.PLATFORM_FEE_RATE);

    // 크리에이터 수익
    const creatorEarnings = afterStripe.minus(platformFee);

    return {
      gross: gross.toFixed(0),
      stripeFee: stripeFee.toFixed(0),
      platformFee: platformFee.toFixed(0),
      creatorEarnings: creatorEarnings.toFixed(0),
    };
  }

  static calculateReferralCommission(
    amount: number,
    commissionRate: number
  ): string {
    return new Decimal(amount)
      .mul(new Decimal(commissionRate).div(100))
      .toFixed(0);
  }
}
```

### 3.3 결제 재조정 (Reconciliation)

```typescript
// src/lib/payments/reconciliation.ts
export class PaymentReconciliation {
  async reconcileDaily(): Promise<ReconciliationReport> {
    const yesterday = subDays(new Date(), 1);
    const startOfYesterday = startOfDay(yesterday);
    const endOfYesterday = endOfDay(yesterday);

    // DB에서 결제 기록 조회
    const dbTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startOfYesterday,
          lte: endOfYesterday,
        }
      }
    });

    // Stripe에서 결제 기록 조회
    const stripeCharges = await stripe.charges.list({
      created: {
        gte: Math.floor(startOfYesterday.getTime() / 1000),
        lte: Math.floor(endOfYesterday.getTime() / 1000),
      },
      limit: 100,
    });

    // 불일치 찾기
    const discrepancies: Discrepancy[] = [];

    for (const charge of stripeCharges.data) {
      const dbRecord = dbTransactions.find(
        t => t.stripeChargeId === charge.id
      );

      if (!dbRecord) {
        discrepancies.push({
          type: 'MISSING_IN_DB',
          stripeId: charge.id,
          amount: charge.amount,
        });
      } else if (dbRecord.amount !== charge.amount) {
        discrepancies.push({
          type: 'AMOUNT_MISMATCH',
          stripeId: charge.id,
          dbAmount: dbRecord.amount,
          stripeAmount: charge.amount,
        });
      }
    }

    // 리포트 생성
    return {
      date: yesterday,
      totalTransactions: stripeCharges.data.length,
      matchedCount: stripeCharges.data.length - discrepancies.length,
      discrepancies,
      totalAmount: stripeCharges.data.reduce((sum, c) => sum + c.amount, 0),
    };
  }
}
```

### 체크리스트

- [ ] Webhook 멱등성 구현
- [ ] 트랜잭션 일관성 보장 (Prisma $transaction)
- [ ] Decimal.js로 정밀 계산
- [ ] 환불 처리 구현
- [ ] 분쟁(Dispute) 처리 구현
- [ ] 결제 재조정 시스템
- [ ] 결제 실패 재시도 로직
- [ ] 영수증 발행 시스템

---

## 📊 Phase 4: 모니터링 & 관찰가능성 (Datadog 수준)

> **기간:** 1.5주
> **벤치마크:** Uber Observability, Netflix Atlas

### 4.1 구조화된 로깅

```typescript
// src/lib/logging/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'creatorcircle',
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
  redact: {
    paths: ['password', 'token', 'secret', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Request 로깅을 위한 child logger
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    userId,
  });
}

// 사용 예시
// const log = createRequestLogger(req.headers['x-request-id'], session?.user?.id);
// log.info({ action: 'circle.create', circleId: '...' }, 'Circle created');
```

### 4.2 에러 추적 (Sentry 통합)

```typescript
// src/lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Prisma({ client: prisma }),
  ],
  beforeSend(event, hint) {
    // 민감한 정보 필터링
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}
```

### 4.3 메트릭 수집

```typescript
// src/lib/monitoring/metrics.ts
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

const registry = new Registry();

// HTTP 요청 메트릭
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

// 비즈니스 메트릭
export const subscriptionsActive = new Gauge({
  name: 'subscriptions_active',
  help: 'Number of active subscriptions',
  labelNames: ['tier'],
  registers: [registry],
});

export const paymentsTotal = new Counter({
  name: 'payments_total',
  help: 'Total payments processed',
  labelNames: ['status', 'type'],
  registers: [registry],
});

export const paymentAmount = new Histogram({
  name: 'payment_amount_krw',
  help: 'Payment amount distribution in KRW',
  buckets: [1000, 5000, 10000, 30000, 50000, 100000, 500000],
  registers: [registry],
});

// DB 쿼리 메트릭
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

// /api/metrics 엔드포인트용
export async function getMetrics(): Promise<string> {
  return registry.metrics();
}
```

### 4.4 Health Check

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    stripe: 'ok' | 'error';
  };
  latency: {
    database: number;
    redis: number;
  };
}

export async function GET() {
  const startTime = Date.now();
  const checks = { database: 'error', redis: 'error', stripe: 'error' } as const;
  const latency = { database: 0, redis: 0 };

  // Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    latency.database = Date.now() - dbStart;
    checks.database = 'ok';
  } catch {}

  // Redis check
  try {
    const redisStart = Date.now();
    await redis.ping();
    latency.redis = Date.now() - redisStart;
    checks.redis = 'ok';
  } catch {}

  // Stripe check
  try {
    await stripe.balance.retrieve();
    checks.stripe = 'ok';
  } catch {}

  const allHealthy = Object.values(checks).every(c => c === 'ok');
  const status = allHealthy ? 'healthy' : 'degraded';

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'unknown',
    checks,
    latency,
  };

  return NextResponse.json(response, {
    status: status === 'healthy' ? 200 : 503,
  });
}
```

### 4.5 실시간 알림

```typescript
// src/lib/monitoring/alerts.ts
interface AlertConfig {
  channel: 'slack' | 'email' | 'pagerduty';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  context?: Record<string, unknown>;
}

export class AlertService {
  async send(config: AlertConfig): Promise<void> {
    const { channel, severity, message, context } = config;

    switch (channel) {
      case 'slack':
        await this.sendSlack(severity, message, context);
        break;
      case 'pagerduty':
        await this.sendPagerDuty(severity, message, context);
        break;
      case 'email':
        await this.sendEmail(severity, message, context);
        break;
    }
  }

  private async sendSlack(
    severity: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    const color = severity === 'critical' ? '#ff0000' :
                  severity === 'warning' ? '#ffaa00' : '#00ff00';

    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      body: JSON.stringify({
        attachments: [{
          color,
          title: `[${severity.toUpperCase()}] CreatorCircle Alert`,
          text: message,
          fields: context ? Object.entries(context).map(([k, v]) => ({
            title: k,
            value: String(v),
            short: true
          })) : [],
          ts: Math.floor(Date.now() / 1000),
        }]
      }),
    });
  }
}

// 알림 규칙
export const alertRules = {
  // 에러율 5% 초과
  highErrorRate: {
    condition: (errorRate: number) => errorRate > 5,
    channel: 'pagerduty' as const,
    severity: 'critical' as const,
  },
  // 응답 시간 2초 초과
  slowResponse: {
    condition: (p95: number) => p95 > 2000,
    channel: 'slack' as const,
    severity: 'warning' as const,
  },
  // 결제 실패
  paymentFailed: {
    channel: 'slack' as const,
    severity: 'warning' as const,
  },
};
```

### 체크리스트

- [ ] Pino 구조화된 로깅 설정
- [ ] Sentry 통합
- [ ] Prometheus 메트릭 엔드포인트
- [ ] Health Check API
- [ ] Grafana 대시보드 구성
- [ ] Slack 알림 통합
- [ ] 에러율 알림 규칙
- [ ] 응답 시간 알림 규칙
- [ ] 결제 모니터링 대시보드

---

## 🧪 Phase 5: 테스팅 (Microsoft 수준)

> **기간:** 2주
> **벤치마크:** Microsoft Testing Standards, Google Testing Practices

### 5.1 테스트 구조

```
tests/
├── unit/                    # 단위 테스트
│   ├── lib/
│   │   ├── payments/
│   │   │   └── calculations.test.ts
│   │   └── security/
│   │       └── sanitize.test.ts
│   └── components/
│       └── ui/
│           └── button.test.tsx
├── integration/             # 통합 테스트
│   ├── api/
│   │   ├── auth.test.ts
│   │   ├── circles.test.ts
│   │   └── payments.test.ts
│   └── db/
│       └── transactions.test.ts
├── e2e/                     # E2E 테스트
│   ├── auth.spec.ts
│   ├── subscription.spec.ts
│   └── creator-onboarding.spec.ts
├── performance/             # 성능 테스트
│   ├── load.test.ts
│   └── stress.test.ts
└── fixtures/                # 테스트 데이터
    ├── users.ts
    ├── circles.ts
    └── payments.ts
```

### 5.2 단위 테스트 예시

```typescript
// tests/unit/lib/payments/calculations.test.ts
import { describe, it, expect } from 'vitest';
import { PaymentCalculator } from '@/lib/payments/calculations';

describe('PaymentCalculator', () => {
  describe('calculateCreatorEarnings', () => {
    it('should correctly calculate earnings for 10000 KRW', () => {
      const result = PaymentCalculator.calculateCreatorEarnings(10000);

      // Stripe 수수료: 10000 * 0.029 + 30 = 320
      // 플랫폼 수수료: (10000 - 320) * 0.1 = 968
      // 크리에이터 수익: 10000 - 320 - 968 = 8712

      expect(result.gross).toBe('10000');
      expect(result.stripeFee).toBe('320');
      expect(result.platformFee).toBe('968');
      expect(result.creatorEarnings).toBe('8712');
    });

    it('should handle zero amount', () => {
      const result = PaymentCalculator.calculateCreatorEarnings(0);
      expect(result.creatorEarnings).toBe('0');
    });

    it('should handle large amounts without precision loss', () => {
      const result = PaymentCalculator.calculateCreatorEarnings(1000000);
      expect(Number(result.gross)).toBe(1000000);
    });
  });

  describe('calculateReferralCommission', () => {
    it('should calculate 30% commission correctly', () => {
      const commission = PaymentCalculator.calculateReferralCommission(10000, 30);
      expect(commission).toBe('3000');
    });
  });
});
```

### 5.3 통합 테스트 예시

```typescript
// tests/integration/api/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { POST } from '@/app/api/auth/signup/route';
import { prisma } from '@/lib/prisma';

describe('POST /api/auth/signup', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  it('should create a new user with valid data', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123',
        name: '테스트 사용자',
        username: 'testuser',
      },
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.user.email).toBe('test@example.com');
    expect(data.user.username).toBe('testuser');
    expect(data.user.password).toBeUndefined(); // 비밀번호 노출 안됨
  });

  it('should reject duplicate email', async () => {
    // 먼저 사용자 생성
    await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashed',
        name: 'Existing',
        username: 'existing',
      },
    });

    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123',
        name: '테스트',
        username: 'newuser',
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(409);
  });

  it('should validate password requirements', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'weak', // 너무 약한 비밀번호
        name: '테스트',
        username: 'testuser',
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
```

### 5.4 E2E 테스트 (Playwright)

```typescript
// tests/e2e/subscription.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Subscription Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 테스트 사용자로 로그인
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestP@ssw0rd123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should complete subscription to a circle', async ({ page }) => {
    // 서클 페이지로 이동
    await page.goto('/circle/tech-insights');

    // 구독 버튼 클릭
    await page.click('button:has-text("월간 구독")');

    // Stripe Checkout으로 리다이렉트 확인
    await expect(page).toHaveURL(/checkout.stripe.com/);

    // Stripe 테스트 결제 정보 입력
    await page.fill('[name="cardNumber"]', '4242424242424242');
    await page.fill('[name="cardExpiry"]', '12/30');
    await page.fill('[name="cardCvc"]', '123');
    await page.click('button:has-text("구독하기")');

    // 성공 페이지로 리다이렉트
    await expect(page).toHaveURL(/\/circle\/tech-insights\?success=true/);

    // 구독 상태 확인
    await expect(page.locator('.membership-badge')).toBeVisible();
  });
});
```

### 5.5 부하 테스트 (k6)

```javascript
// tests/performance/load.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // 1분 동안 100 VU로 증가
    { duration: '3m', target: 100 },   // 3분 유지
    { duration: '1m', target: 200 },   // 1분 동안 200 VU로 증가
    { duration: '3m', target: 200 },   // 3분 유지
    { duration: '1m', target: 0 },     // 쿨다운
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% 요청이 500ms 이내
    http_req_failed: ['rate<0.01'],    // 에러율 1% 미만
  },
};

export default function () {
  // 홈페이지
  let response = http.get('https://creatorcircle.com/');
  check(response, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads fast': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // 탐색 페이지
  response = http.get('https://creatorcircle.com/explore');
  check(response, {
    'explore status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // API 호출
  response = http.get('https://creatorcircle.com/api/circles?limit=20');
  check(response, {
    'api status is 200': (r) => r.status === 200,
    'api returns data': (r) => JSON.parse(r.body).circles.length > 0,
  });

  sleep(2);
}
```

### 체크리스트

- [ ] Vitest 설정
- [ ] 단위 테스트 작성 (커버리지 80% 이상)
- [ ] 통합 테스트 작성
- [ ] Playwright E2E 테스트 작성
- [ ] k6 부하 테스트 작성
- [ ] GitHub Actions CI 통합
- [ ] 테스트 커버리지 리포트
- [ ] 접근성 테스트 (axe-core)
- [ ] 브라우저 호환성 테스트

---

## 🚀 Phase 6: 성능 최적화 (Google 수준)

> **기간:** 1.5주
> **벤치마크:** YouTube Loading, Instagram Infinite Scroll

### 6.1 Core Web Vitals 최적화

```typescript
// next.config.ts 최적화
import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const config: NextConfig = {
  // 이미지 최적화
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1년
    domains: ['cdn.creatorcircle.com'],
  },

  // 압축
  compress: true,

  // 헤더 최적화
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // Webpack 최적화
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            minChunks: 2,
            priority: -10,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(config);
```

### 6.2 가상 스크롤링

```typescript
// src/components/virtual-list.tsx
'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize: number;
  overscan?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  overscan = 5,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onEndReached) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollProgress = (scrollTop + clientHeight) / scrollHeight;

    if (scrollProgress > endReachedThreshold) {
      onEndReached();
    }
  }, [onEndReached, endReachedThreshold]);

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className="h-full overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.3 이미지 최적화 컴포넌트

```typescript
// src/components/optimized-image.tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  quality?: number;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  quality = 75,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={cn(
          'bg-gray-200 flex items-center justify-center',
          className
        )}
        style={{ width, height }}
      >
        <span className="text-gray-400">이미지를 불러올 수 없습니다</span>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ width, height }}
        />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        quality={quality}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgICAgEFAQAAAAAAAAAAAQIDBAURAAYhBxITMUFh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQADAAMAAAAAAAAAAAAAAAAAAQIREiH/2gAMAwEAAhEDEEwg"
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
      />
    </div>
  );
}
```

### 6.4 캐싱 전략

```typescript
// src/lib/cache/index.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

interface CacheConfig {
  ttl: number;  // seconds
  staleWhileRevalidate?: number;
}

export class CacheService {
  // 캐시 읽기/쓰기
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get<T>(key);
    return data;
  }

  async set<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    await redis.setex(key, config.ttl, value);
  }

  // Stale-While-Revalidate 패턴
  async swr<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached) {
      // 백그라운드에서 갱신
      if (config.staleWhileRevalidate) {
        this.revalidate(key, fetcher, config);
      }
      return cached;
    }

    const fresh = await fetcher();
    await this.set(key, fresh, config);
    return fresh;
  }

  private async revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig
  ): Promise<void> {
    // 비동기로 갱신 (응답 대기 안함)
    fetcher().then(data => this.set(key, data, config));
  }

  // 캐시 무효화
  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

export const cache = new CacheService();

// 사용 예시
// const circles = await cache.swr(
//   'circles:popular',
//   () => prisma.circle.findMany({ take: 10 }),
//   { ttl: 300, staleWhileRevalidate: 60 }
// );
```

### 체크리스트

- [ ] 번들 분석 및 최적화
- [ ] 이미지 최적화 (WebP/AVIF)
- [ ] 가상 스크롤링 구현
- [ ] Redis 캐싱 레이어
- [ ] API 응답 캐싱
- [ ] 정적 페이지 생성 (SSG)
- [ ] 코드 스플리팅
- [ ] 프리페칭/프리로딩
- [ ] Web Worker 활용
- [ ] Lighthouse 90+ 달성

---

## 📦 Phase 7: CI/CD 및 배포 (Amazon 수준)

> **기간:** 1주
> **벤치마크:** GitHub Actions, Vercel Preview Deployments

### 7.1 GitHub Actions 워크플로우

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  # 코드 품질 검사
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

  # 테스트
  test:
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: --health-cmd pg_isready
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma db push
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # 빌드
  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: 1

      - name: Bundle analysis
        run: npm run analyze

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next

  # E2E 테스트
  e2e:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Download build
        uses: actions/download-artifact@v4
        with:
          name: build
          path: .next

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report

  # 프로덕션 배포
  deploy:
    runs-on: ubuntu-latest
    needs: [build, e2e]
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Run smoke tests
        run: |
          npm run test:smoke -- --url ${{ steps.deploy.outputs.preview-url }}

      - name: Notify Slack
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 7.2 데이터베이스 마이그레이션 전략

```typescript
// scripts/migrate-production.ts
import { execSync } from 'child_process';

async function migrateProduction() {
  console.log('🔄 Starting production migration...');

  // 1. 백업 생성
  console.log('📦 Creating backup...');
  execSync('pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql');

  // 2. 마이그레이션 실행
  console.log('🚀 Running migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Migration successful!');
  } catch (error) {
    console.error('❌ Migration failed!');

    // 3. 롤백
    console.log('⏪ Rolling back...');
    execSync('psql $DATABASE_URL < backup-*.sql');

    throw error;
  }

  // 4. 검증
  console.log('🔍 Validating...');
  execSync('npx prisma validate', { stdio: 'inherit' });

  console.log('🎉 Production migration complete!');
}

migrateProduction();
```

### 체크리스트

- [ ] GitHub Actions CI 파이프라인
- [ ] 자동화된 테스트 실행
- [ ] Vercel/AWS 자동 배포
- [ ] Preview Deployments
- [ ] 데이터베이스 마이그레이션 자동화
- [ ] 롤백 메커니즘
- [ ] 배포 알림 (Slack)
- [ ] 환경별 설정 관리

---

## 📝 Phase 8: 문서화 (Stripe 수준)

> **기간:** 1주
> **벤치마크:** Stripe Documentation, Twilio API Docs

### 8.1 API 문서 (OpenAPI)

```yaml
# openapi/spec.yaml
openapi: 3.1.0
info:
  title: CreatorCircle API
  version: 1.0.0
  description: 크리에이터 커뮤니티 플랫폼 API

servers:
  - url: https://api.creatorcircle.com/v1
    description: Production
  - url: https://api-staging.creatorcircle.com/v1
    description: Staging

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Circle:
      type: object
      properties:
        id:
          type: string
          format: cuid
        name:
          type: string
          maxLength: 100
        slug:
          type: string
          pattern: ^[a-z0-9-]+$
        description:
          type: string
        category:
          type: string
          enum: [TECH, BUSINESS, LIFESTYLE, CREATIVE, EDUCATION]
        memberCount:
          type: integer
          minimum: 0
        createdAt:
          type: string
          format: date-time

    Error:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object

paths:
  /circles:
    get:
      summary: 서클 목록 조회
      tags: [Circles]
      parameters:
        - name: category
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        '200':
          description: 성공
          content:
            application/json:
              schema:
                type: object
                properties:
                  circles:
                    type: array
                    items:
                      $ref: '#/components/schemas/Circle'
                  nextCursor:
                    type: string
```

### 8.2 개발자 가이드 구조

```markdown
docs/
├── getting-started/
│   ├── introduction.md
│   ├── quickstart.md
│   └── authentication.md
├── guides/
│   ├── circles.md
│   ├── subscriptions.md
│   ├── payments.md
│   └── webhooks.md
├── api-reference/
│   ├── authentication.md
│   ├── circles.md
│   ├── posts.md
│   ├── subscriptions.md
│   └── webhooks.md
├── operations/
│   ├── deployment.md
│   ├── monitoring.md
│   ├── troubleshooting.md
│   └── disaster-recovery.md
└── architecture/
    ├── overview.md
    ├── database.md
    └── security.md
```

### 체크리스트

- [ ] OpenAPI 스펙 작성
- [ ] API 레퍼런스 문서
- [ ] 개발자 가이드
- [ ] 아키텍처 다이어그램
- [ ] 운영 매뉴얼
- [ ] 트러블슈팅 가이드
- [ ] CHANGELOG 유지
- [ ] README 업데이트

---

## 📅 전체 일정 요약

| Phase | 내용 | 기간 | 우선순위 |
|-------|------|------|---------|
| 1 | 에러 처리 & 복원력 | 2주 | 🔴 Critical |
| 2 | 보안 강화 | 2주 | 🔴 Critical |
| 3 | 결제 안정성 | 2주 | 🔴 Critical |
| 4 | 모니터링 & 관찰가능성 | 1.5주 | 🔴 Critical |
| 5 | 테스팅 | 2주 | 🔴 Critical |
| 6 | 성능 최적화 | 1.5주 | 🟡 High |
| 7 | CI/CD & 배포 | 1주 | 🟡 High |
| 8 | 문서화 | 1주 | 🟢 Medium |

**총 예상 기간: 13주 (약 3개월)**

---

## 🎯 마일스톤

### M1: 보안 & 안정성 (4주)
- Phase 1 + 2 완료
- 목표: 프로덕션 배포 가능한 보안 수준

### M2: 신뢰성 확보 (3.5주)
- Phase 3 + 4 완료
- 목표: 99.9% 가용성 달성 가능

### M3: 품질 보증 (3.5주)
- Phase 5 + 6 완료
- 목표: 테스트 커버리지 80%, Lighthouse 90+

### M4: 운영 준비 (2주)
- Phase 7 + 8 완료
- 목표: 완전 자동화된 배포 파이프라인

---

## 💡 핵심 원칙

```javascript
const PRODUCTION_PRINCIPLES = {
  "Murphy's Law": "발생할 수 있는 모든 것은 발생한다",
  "방어적 프로그래밍": "모든 입력을 의심하고 모든 출력을 검증",
  "페일 세이프": "실패하더라도 안전하게 실패",
  "관찰가능성": "측정할 수 없으면 개선할 수 없다",
  "점진적 롤아웃": "한 번에 모두 배포하지 마라",
  "자동화": "수동으로 두 번 이상 하면 자동화",
  "문서화": "6개월 후의 당신도 모르는 사람이다",
  "성능": "느린 것은 버그다",
  "보안": "보안은 나중에 추가하는 것이 아니다",
  "백업": "백업이 없으면 데이터도 없다"
};
```

---

> **Note:** 이 계획서는 현재 코드베이스 분석을 바탕으로 작성되었습니다.
> Netflix, Spotify, Stripe 등 업계 최고 수준의 서비스를 벤치마크로 삼아
> "작동하는 MVP"에서 "프로덕션 레디 서비스"로 발전시키는 로드맵입니다.
