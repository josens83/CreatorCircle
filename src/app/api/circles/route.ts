/**
 * Circles API Routes
 *
 * GET /api/circles - 서클 목록 조회 (공개)
 * POST /api/circles - 새 서클 생성 (크리에이터만)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import {
  apiHandler,
  successResponse,
  createdResponse,
  paginatedResponse,
  parseJsonBody,
  getNumberParam,
  AuthenticatedContext,
} from '@/lib/api/handler';
import {
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '@/lib/errors';
import { retryDatabaseOperation } from '@/lib/resilience';

// ============================================
// Validation Schemas
// ============================================

const createCircleSchema = z.object({
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다').max(100),
  tagline: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  type: z.enum(['COMMUNITY', 'NEWSLETTER', 'HYBRID']).default('HYBRID'),
  category: z.enum([
    'TECH',
    'BUSINESS',
    'FINANCE',
    'CAREER',
    'MARKETING',
    'DESIGN',
    'WRITING',
    'LIFESTYLE',
    'EDUCATION',
    'ENTERTAINMENT',
  ]),
  pricing: z.object({
    hasFreeTier: z.boolean().default(true),
    monthlyPrice: z.number().min(0).max(10000000).optional(),
    yearlyPrice: z.number().min(0).max(100000000).optional(),
    yearlyDiscount: z.number().min(0).max(100).optional(),
  }),
});

const categoryEnum = z.enum([
  'TECH', 'BUSINESS', 'FINANCE', 'CAREER', 'MARKETING',
  'DESIGN', 'WRITING', 'LIFESTYLE', 'EDUCATION', 'ENTERTAINMENT',
]).optional();

const sortEnum = z.enum(['trending', 'newest', 'members']).default('trending');

// ============================================
// GET /api/circles - 서클 목록 조회
// ============================================

export const GET = apiHandler(async (request: NextRequest, context) => {
  const { searchParams } = context;

  // 파라미터 파싱 및 검증
  const categoryParam = searchParams?.get('category');
  const category = categoryParam && categoryParam !== 'all'
    ? categoryEnum.parse(categoryParam.toUpperCase())
    : undefined;

  const sort = sortEnum.parse(searchParams?.get('sort') || 'trending');
  const page = getNumberParam(searchParams!, 'page', 1, 1, 1000);
  const limit = getNumberParam(searchParams!, 'limit', 12, 1, 100);

  // 쿼리 조건
  const where = {
    status: 'ACTIVE' as const,
    visibility: 'PUBLIC' as const,
    ...(category && { category }),
  };

  // 정렬 조건
  const orderBy = sort === 'newest'
    ? { createdAt: 'desc' as const }
    : { memberCount: 'desc' as const };

  // DB 조회 (재시도 로직 적용)
  const [circles, total] = await retryDatabaseOperation(() =>
    Promise.all([
      prisma.circle.findMany({
        where,
        include: {
          creator: {
            include: {
              user: {
                select: {
                  name: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              posts: true,
              members: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.circle.count({ where }),
    ])
  );

  return paginatedResponse(circles, {
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});

// ============================================
// POST /api/circles - 새 서클 생성
// ============================================

export const POST = apiHandler<true>(
  async (request: NextRequest, context: AuthenticatedContext) => {
    const { session } = context;

    // 크리에이터인지 확인
    const creator = await retryDatabaseOperation(() =>
      prisma.creator.findUnique({
        where: { userId: session.user.id },
      })
    );

    if (!creator) {
      throw new ForbiddenError('크리에이터 등록이 필요합니다');
    }

    // 요청 본문 파싱 및 검증
    const body = await parseJsonBody(request);
    const validation = createCircleSchema.safeParse(body);

    if (!validation.success) {
      throw new ValidationError(
        validation.error.errors[0].message,
        validation.error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = acc[path] || [];
          acc[path].push(err.message);
          return acc;
        }, {} as Record<string, string[]>)
      );
    }

    const { name, tagline, description, type, category, pricing } = validation.data;

    // Slug 생성 (충돌 방지)
    let slug = slugify(name);
    let counter = 1;

    // 트랜잭션으로 slug 유니크 보장
    const circle = await retryDatabaseOperation(async () => {
      // Slug 중복 체크
      let existingSlug = await prisma.circle.findUnique({ where: { slug } });
      while (existingSlug) {
        slug = `${slugify(name)}-${counter}`;
        counter++;
        existingSlug = await prisma.circle.findUnique({ where: { slug } });

        // 무한 루프 방지
        if (counter > 100) {
          throw new ConflictError('서클 이름을 변경해 주세요');
        }
      }

      // 서클 생성
      return prisma.circle.create({
        data: {
          creatorId: creator.id,
          name,
          slug,
          tagline,
          description,
          type,
          category,
          pricing,
          tags: [],
        },
        include: {
          creator: {
            include: {
              user: {
                select: {
                  name: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    });

    return createdResponse(circle);
  },
  { requireAuth: true }
);
