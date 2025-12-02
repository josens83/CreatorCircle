/**
 * Next.js Middleware
 *
 * 모든 요청에 적용되는 보안 미들웨어
 * - Security Headers
 * - Rate Limiting
 * - Request Validation
 * - CORS
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  securityMiddleware,
  getRateLimiterForPath,
  getClientIP,
  getIdentifier,
  RateLimiter,
} from '@/lib/security';

// ============================================
// Middleware Configuration
// ============================================

/**
 * Rate Limiting이 적용되는 경로
 */
const RATE_LIMITED_PATHS = [
  '/api/auth',
  '/api/circles',
  '/api/posts',
  '/api/creators',
  '/api/payments',
  '/api/subscriptions',
  '/api/search',
  '/api/upload',
];

/**
 * Rate Limiting이 제외되는 경로
 */
const RATE_LIMIT_EXCLUDED = [
  '/api/webhooks', // Webhook은 별도 처리
  '/api/health',   // Health check
  '/_next',
  '/favicon.ico',
];

// ============================================
// Main Middleware
// ============================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 정적 자산 제외
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // 파일 확장자가 있는 경우
  ) {
    return NextResponse.next();
  }

  // 2. Security Headers 적용
  const securityResponse = securityMiddleware(request);
  if (securityResponse) {
    // OPTIONS 요청이거나 에러 응답인 경우 바로 반환
    if (request.method === 'OPTIONS' || securityResponse.status >= 400) {
      return securityResponse;
    }
  }

  // 3. Rate Limiting (API 경로에만)
  if (pathname.startsWith('/api/')) {
    // 제외 경로 확인
    const shouldRateLimit = !RATE_LIMIT_EXCLUDED.some(path =>
      pathname.startsWith(path)
    );

    if (shouldRateLimit) {
      const rateLimitResponse = await applyRateLimit(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    }
  }

  // 4. Security Response 반환 또는 다음으로
  return securityResponse || NextResponse.next();
}

// ============================================
// Rate Limiting Helper
// ============================================

async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request.headers);

  // 사용자 ID 추출 (세션에서)
  // Note: 미들웨어에서는 세션 접근이 제한적이므로 IP 기반으로 진행
  const identifier = getIdentifier(ip);

  // 경로에 맞는 Rate Limiter 선택
  const limiter = getRateLimiterForPath(pathname);

  // Rate Limit 확인
  const result = await limiter.check(identifier);

  if (!result.success) {
    // Rate Limit 초과
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
          retryAfter: result.retryAfter,
        },
      },
      {
        status: 429,
        headers: RateLimiter.getHeaders(result),
      }
    );
  }

  // Rate Limit 통과 - 헤더에 정보 추가
  const response = NextResponse.next();
  const headers = RateLimiter.getHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return null; // 통과
}

// ============================================
// Middleware Config
// ============================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
