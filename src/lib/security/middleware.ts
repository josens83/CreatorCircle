/**
 * Security Middleware for Next.js
 *
 * Stripe/GitHub 수준의 보안 헤더 및 보호
 * - Security Headers (CSP, HSTS, etc.)
 * - CORS 설정
 * - Request 검증
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================
// Configuration
// ============================================

const isDev = process.env.NODE_ENV === 'development';

// 허용된 도메인 목록
const ALLOWED_ORIGINS = [
  'https://creatorcircle.com',
  'https://www.creatorcircle.com',
  'https://api.creatorcircle.com',
  ...(isDev ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
];

// CSP 지시문
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Next.js 인라인 스크립트 (프로덕션에서는 nonce 사용 권장)
    "'unsafe-eval'", // 개발 모드에서만 필요
    'https://js.stripe.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Tailwind CSS 인라인 스타일
    'https://fonts.googleapis.com',
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'data:',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https:',
    'https://*.amazonaws.com', // S3 이미지
    'https://lh3.googleusercontent.com', // Google 프로필
    'https://avatars.githubusercontent.com', // GitHub 프로필
  ],
  'connect-src': [
    "'self'",
    'https://api.stripe.com',
    'https://api.creatorcircle.com',
    'wss://*.creatorcircle.com',
    'https://www.google-analytics.com',
    'https://vitals.vercel-insights.com',
    ...(isDev ? ['ws://localhost:3000', 'http://localhost:3000'] : []),
  ],
  'frame-src': [
    "'self'",
    'https://js.stripe.com',
    'https://hooks.stripe.com',
    'https://www.youtube.com',
  ],
  'frame-ancestors': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [],
};

// ============================================
// Security Headers Builder
// ============================================

function buildCSP(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, values]) => {
      if (values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

function getSecurityHeaders(): Record<string, string> {
  return {
    // XSS 보호
    'X-XSS-Protection': '1; mode=block',

    // MIME 타입 스니핑 방지
    'X-Content-Type-Options': 'nosniff',

    // Clickjacking 방지
    'X-Frame-Options': 'SAMEORIGIN',

    // DNS Prefetch 제어
    'X-DNS-Prefetch-Control': 'on',

    // Referrer 정책
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // HSTS (HTTPS 강제)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // 권한 정책
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()', // FLoC 비활성화
      'browsing-topics=()',
      'payment=(self "https://js.stripe.com")',
    ].join(', '),

    // Content Security Policy
    'Content-Security-Policy': buildCSP(),

    // 크로스 사이트 스크립팅 정책
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  };
}

// ============================================
// CORS Handler
// ============================================

function handleCORS(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');

  // 허용된 오리진인지 확인
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-Request-Id'
    );
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  return response;
}

// ============================================
// Request Validation
// ============================================

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateRequest(request: NextRequest): ValidationResult {
  // 1. 요청 크기 제한 (10MB)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return { valid: false, error: 'Request too large' };
  }

  // 2. Content-Type 검증 (POST/PUT/PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
    ];

    if (contentType && !allowedTypes.some(type => contentType.includes(type))) {
      // Stripe webhook은 예외
      if (!request.nextUrl.pathname.includes('/webhooks/')) {
        return { valid: false, error: 'Invalid content type' };
      }
    }
  }

  // 3. User-Agent 필수 (봇 방어)
  const userAgent = request.headers.get('user-agent');
  if (!userAgent || userAgent.length < 5) {
    // API 라우트에서만 적용
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return { valid: false, error: 'User-Agent required' };
    }
  }

  return { valid: true };
}

// ============================================
// Main Middleware Function
// ============================================

export function securityMiddleware(request: NextRequest): NextResponse | null {
  // OPTIONS 요청 처리 (CORS Preflight)
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return handleCORS(request, response);
  }

  // 요청 검증
  const validation = validateRequest(request);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // 응답 생성
  const response = NextResponse.next();

  // Security Headers 추가
  const securityHeaders = getSecurityHeaders();
  for (const [header, value] of Object.entries(securityHeaders)) {
    response.headers.set(header, value);
  }

  // CORS 처리
  handleCORS(request, response);

  // Request ID 추가 (추적용)
  const requestId = request.headers.get('x-request-id') ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  response.headers.set('X-Request-Id', requestId);

  return response;
}

// ============================================
// Path Matchers
// ============================================

// 보안 헤더를 적용할 경로
export const SECURITY_PATHS = [
  '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
];

// API 라우트 경로
export const API_PATHS = ['/api/:path*'];

// 정적 자산 경로 (캐싱 헤더용)
export const STATIC_PATHS = [
  '/_next/static/:path*',
  '/images/:path*',
  '/fonts/:path*',
];
