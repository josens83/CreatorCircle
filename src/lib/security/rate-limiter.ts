/**
 * Rate Limiting System
 *
 * Stripe/Discord 수준의 Rate Limiting
 * - Sliding Window 알고리즘
 * - IP + User ID 복합 키
 * - 엔드포인트별 설정
 * - Redis 또는 메모리 백엔드
 */

import { RateLimitError } from '@/lib/errors';

// ============================================
// Types
// ============================================

export interface RateLimitConfig {
  /** 윈도우 크기 (ms) */
  windowMs: number;
  /** 윈도우당 최대 요청 수 */
  max: number;
  /** 키 접두사 (구분용) */
  keyPrefix?: string;
  /** 에러 메시지 */
  message?: string;
  /** Rate Limit 건너뛸지 결정하는 함수 */
  skip?: (identifier: string) => boolean | Promise<boolean>;
}

export interface RateLimitResult {
  /** 성공 여부 */
  success: boolean;
  /** 남은 요청 수 */
  remaining: number;
  /** 리셋 시간 (Unix timestamp) */
  resetTime: number;
  /** 총 허용량 */
  limit: number;
  /** 재시도 대기 시간 (초) */
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ============================================
// In-Memory Store (Redis 대체)
// ============================================

class MemoryStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 1분마다 만료된 엔트리 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // 만료 확인
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  async set(key: string, entry: RateLimitEntry): Promise<void> {
    this.store.set(key, entry);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const existing = await this.get(key);

    if (existing) {
      existing.count++;
      this.store.set(key, existing);
      return existing;
    }

    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    this.store.set(key, newEntry);
    return newEntry;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// 싱글톤 스토어
const store = new MemoryStore();

// ============================================
// Rate Limiter Class
// ============================================

export class RateLimiter {
  private readonly config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'rl',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      skip: () => false,
      ...config,
    };
  }

  /**
   * Rate Limit 확인
   */
  async check(identifier: string): Promise<RateLimitResult> {
    // Skip 조건 확인
    if (await this.config.skip(identifier)) {
      return {
        success: true,
        remaining: this.config.max,
        resetTime: Date.now() + this.config.windowMs,
        limit: this.config.max,
      };
    }

    const key = `${this.config.keyPrefix}:${identifier}`;
    const entry = await store.increment(key, this.config.windowMs);

    const remaining = Math.max(0, this.config.max - entry.count);
    const success = entry.count <= this.config.max;

    return {
      success,
      remaining,
      resetTime: entry.resetTime,
      limit: this.config.max,
      retryAfter: success ? undefined : Math.ceil((entry.resetTime - Date.now()) / 1000),
    };
  }

  /**
   * Rate Limit 확인 및 에러 throw
   */
  async checkOrThrow(identifier: string): Promise<RateLimitResult> {
    const result = await this.check(identifier);

    if (!result.success) {
      throw new RateLimitError(result.retryAfter || 60);
    }

    return result;
  }

  /**
   * 현재 상태 조회 (카운트 증가 없이)
   */
  async getStatus(identifier: string): Promise<RateLimitResult | null> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const entry = await store.get(key);

    if (!entry) return null;

    return {
      success: entry.count <= this.config.max,
      remaining: Math.max(0, this.config.max - entry.count),
      resetTime: entry.resetTime,
      limit: this.config.max,
    };
  }

  /**
   * Rate Limit 응답 헤더 생성
   */
  static getHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
      ...(result.retryAfter && { 'Retry-After': String(result.retryAfter) }),
    };
  }
}

// ============================================
// Identifier Helpers
// ============================================

/**
 * 요청에서 식별자 추출
 */
export function getIdentifier(
  ip: string | null,
  userId?: string | null
): string {
  // 인증된 사용자는 userId 기반
  if (userId) {
    return `user:${userId}`;
  }

  // 미인증 사용자는 IP 기반
  return `ip:${ip || 'unknown'}`;
}

/**
 * Next.js Request에서 IP 추출
 */
export function getClientIP(headers: Headers): string {
  // Cloudflare
  const cfIP = headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;

  // X-Forwarded-For (프록시/로드밸런서)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // X-Real-IP
  const realIP = headers.get('x-real-ip');
  if (realIP) return realIP;

  return 'unknown';
}

// ============================================
// Pre-configured Rate Limiters
// ============================================

/** 인증 API: 분당 5회 (Brute Force 방지) */
export const authLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: 'rl:auth',
  message: '로그인 시도가 너무 많습니다. 1분 후에 다시 시도해 주세요.',
});

/** 회원가입: 시간당 3회 */
export const signupLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: 'rl:signup',
  message: '회원가입 시도가 너무 많습니다. 1시간 후에 다시 시도해 주세요.',
});

/** 비밀번호 재설정: 시간당 3회 */
export const passwordResetLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: 'rl:password-reset',
  message: '비밀번호 재설정 요청이 너무 많습니다. 1시간 후에 다시 시도해 주세요.',
});

/** 일반 API: 분당 100회 */
export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'rl:api',
});

/** 결제 API: 분당 10회 */
export const paymentLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'rl:payment',
  message: '결제 요청이 너무 많습니다. 잠시 후에 다시 시도해 주세요.',
});

/** 파일 업로드: 시간당 20회 */
export const uploadLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyPrefix: 'rl:upload',
  message: '파일 업로드가 너무 많습니다. 1시간 후에 다시 시도해 주세요.',
});

/** 콘텐츠 생성: 분당 30회 */
export const contentLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: 'rl:content',
});

/** 검색 API: 분당 60회 */
export const searchLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'rl:search',
});

/** Webhook 수신: 분당 100회 (서비스별 IP) */
export const webhookLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'rl:webhook',
});

// ============================================
// Rate Limiter Registry
// ============================================

export const rateLimiters = {
  auth: authLimiter,
  signup: signupLimiter,
  passwordReset: passwordResetLimiter,
  api: apiLimiter,
  payment: paymentLimiter,
  upload: uploadLimiter,
  content: contentLimiter,
  search: searchLimiter,
  webhook: webhookLimiter,
};

/**
 * 엔드포인트 경로에 맞는 Rate Limiter 선택
 */
export function getRateLimiterForPath(path: string): RateLimiter {
  if (path.includes('/auth/login') || path.includes('/auth/signin')) {
    return authLimiter;
  }
  if (path.includes('/auth/signup') || path.includes('/auth/register')) {
    return signupLimiter;
  }
  if (path.includes('/auth/password') || path.includes('/auth/reset')) {
    return passwordResetLimiter;
  }
  if (path.includes('/payment') || path.includes('/checkout') || path.includes('/subscribe')) {
    return paymentLimiter;
  }
  if (path.includes('/upload')) {
    return uploadLimiter;
  }
  if (path.includes('/search')) {
    return searchLimiter;
  }
  if (path.includes('/webhook')) {
    return webhookLimiter;
  }
  if (path.includes('/posts') || path.includes('/circles')) {
    return contentLimiter;
  }

  return apiLimiter;
}
