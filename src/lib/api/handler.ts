/**
 * API Route Handler Wrapper
 *
 * Next.js App Router API 라우트를 위한 통합 핸들러
 * - 에러 처리 통합
 * - 요청 로깅
 * - 인증 검증
 * - Rate Limiting (준비)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
  isAppError,
  formatErrorResponse,
} from '@/lib/errors';

// ============================================
// Types
// ============================================

export interface ApiContext {
  params?: Record<string, string>;
  searchParams?: URLSearchParams;
}

export interface AuthenticatedContext extends ApiContext {
  session: {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      creatorId?: string;
    };
  };
}

type ApiHandler<TContext = ApiContext> = (
  request: NextRequest,
  context: TContext
) => Promise<NextResponse | Response>;

interface HandlerOptions {
  /** 인증 필요 여부 */
  requireAuth?: boolean;
  /** 크리에이터 권한 필요 여부 */
  requireCreator?: boolean;
  /** 관리자 권한 필요 여부 */
  requireAdmin?: boolean;
  /** Rate Limit 설정 (requests per minute) */
  rateLimit?: number;
  /** 요청 본문 최대 크기 (bytes) */
  maxBodySize?: number;
}

// ============================================
// Request ID Generator
// ============================================

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// Logging
// ============================================

interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  status?: number;
  error?: string;
}

function logRequest(log: RequestLog): void {
  const level = log.error ? 'error' : log.status && log.status >= 400 ? 'warn' : 'info';
  const message = `[${log.requestId}] ${log.method} ${log.path} - ${log.status || 'pending'}`;

  if (level === 'error') {
    console.error(message, log);
  } else if (level === 'warn') {
    console.warn(message, log);
  } else {
    console.log(message, { ...log, duration: log.duration ? `${log.duration}ms` : undefined });
  }
}

// ============================================
// Error Response Builder
// ============================================

function buildErrorResponse(error: unknown, requestId: string): NextResponse {
  let appError: AppError;

  if (isAppError(error)) {
    appError = error;
  } else if (error instanceof Error) {
    // Prisma 에러 처리
    if (error.message.includes('Unique constraint')) {
      appError = new ValidationError('이미 존재하는 데이터입니다');
    } else if (error.message.includes('Foreign key constraint')) {
      appError = new ValidationError('관련 데이터를 찾을 수 없습니다');
    } else if (error.message.includes('Record to update not found')) {
      appError = new ValidationError('업데이트할 데이터를 찾을 수 없습니다');
    } else {
      appError = new InternalServerError(
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  } else {
    appError = new InternalServerError();
  }

  const response = formatErrorResponse(appError);

  return NextResponse.json(
    {
      ...response,
      requestId,
    },
    {
      status: appError.statusCode,
      headers: {
        'X-Request-Id': requestId,
        ...(appError.statusCode === 429 && {
          'Retry-After': String((appError as any).retryAfter || 60),
        }),
      },
    }
  );
}

// ============================================
// Main Handler Wrapper
// ============================================

/**
 * API 핸들러 래퍼
 *
 * @example
 * ```ts
 * // 인증 불필요
 * export const GET = apiHandler(async (req, ctx) => {
 *   return NextResponse.json({ data: 'public' });
 * });
 *
 * // 인증 필요
 * export const POST = apiHandler(
 *   async (req, ctx) => {
 *     const { session } = ctx;
 *     return NextResponse.json({ userId: session.user.id });
 *   },
 *   { requireAuth: true }
 * );
 * ```
 */
export function apiHandler<TAuth extends boolean = false>(
  handler: TAuth extends true
    ? ApiHandler<AuthenticatedContext>
    : ApiHandler<ApiContext>,
  options: HandlerOptions & { requireAuth?: TAuth } = {}
) {
  return async (
    request: NextRequest,
    { params }: { params?: Promise<Record<string, string>> } = {}
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const resolvedParams = await params;

    const log: RequestLog = {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    };

    try {
      // 1. 인증 검증
      let session = null;

      if (options.requireAuth || options.requireCreator || options.requireAdmin) {
        session = await getServerSession(authOptions);

        if (!session?.user) {
          throw new UnauthorizedError();
        }

        log.userId = session.user.id;

        // 크리에이터 권한 확인
        if (options.requireCreator && !session.user.creatorId) {
          throw new ForbiddenError('크리에이터만 접근할 수 있습니다');
        }

        // 관리자 권한 확인
        if (options.requireAdmin && session.user.role !== 'ADMIN') {
          throw new ForbiddenError('관리자만 접근할 수 있습니다');
        }
      }

      // 2. 컨텍스트 구성
      const context: ApiContext | AuthenticatedContext = {
        params: resolvedParams,
        searchParams: request.nextUrl.searchParams,
        ...(session && { session }),
      };

      // 3. 핸들러 실행
      const response = await (handler as ApiHandler)(request, context);

      // 4. 성공 로깅
      log.status = response.status;
      log.duration = Date.now() - startTime;
      logRequest(log);

      // Request ID 헤더 추가
      const headers = new Headers(response.headers);
      headers.set('X-Request-Id', requestId);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

    } catch (error) {
      // 5. 에러 로깅
      log.error = error instanceof Error ? error.message : 'Unknown error';
      log.duration = Date.now() - startTime;

      const errorResponse = buildErrorResponse(error, requestId);
      log.status = errorResponse.status;
      logRequest(log);

      return errorResponse;
    }
  };
}

// ============================================
// Response Helpers
// ============================================

/**
 * 성공 응답 생성
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

/**
 * 생성 성공 응답 (201)
 */
export function createdResponse<T>(data: T): NextResponse {
  return NextResponse.json(
    { success: true, data },
    { status: 201 }
  );
}

/**
 * 내용 없음 응답 (204)
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * 페이지네이션 응답
 */
export function paginatedResponse<T>(
  items: T[],
  pagination: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
    nextCursor?: string;
  }
): NextResponse {
  return NextResponse.json({
    success: true,
    data: items,
    pagination: {
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.hasMore ?? items.length === pagination.limit,
      ...(pagination.nextCursor && { nextCursor: pagination.nextCursor }),
    },
  });
}

// ============================================
// Request Helpers
// ============================================

/**
 * JSON 본문 파싱 with 에러 처리
 */
export async function parseJsonBody<T>(request: NextRequest): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new ValidationError('올바른 JSON 형식이 아닙니다');
  }
}

/**
 * 쿼리 파라미터에서 숫자 추출
 */
export function getNumberParam(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const value = searchParams.get(key);
  if (!value) return defaultValue;

  const num = parseInt(value, 10);
  if (isNaN(num)) return defaultValue;

  let result = num;
  if (min !== undefined) result = Math.max(result, min);
  if (max !== undefined) result = Math.min(result, max);

  return result;
}

/**
 * 커서 기반 페이지네이션 파라미터 추출
 */
export function getPaginationParams(searchParams: URLSearchParams): {
  cursor?: string;
  limit: number;
} {
  return {
    cursor: searchParams.get('cursor') || undefined,
    limit: getNumberParam(searchParams, 'limit', 20, 1, 100),
  };
}
