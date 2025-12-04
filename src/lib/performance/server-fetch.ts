/**
 * Server-Side Data Fetching Utilities
 * Optimized patterns for React Server Components
 */

import { cache } from 'react';
import { prisma } from '@/lib/prisma';

// =============================================================================
// Types
// =============================================================================

export interface FetchOptions {
  revalidate?: number | false;
  tags?: string[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

// =============================================================================
// React Cache Wrappers
// =============================================================================

/**
 * Cache user data for the duration of a request
 * Prevents duplicate database queries in the same render
 */
export const getUser = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
    },
  });
});

/**
 * Cache circle data with creator info
 */
export const getCircle = cache(async (circleIdOrSlug: string) => {
  return prisma.circle.findFirst({
    where: {
      OR: [
        { id: circleIdOrSlug },
        { slug: circleIdOrSlug },
      ],
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      memberships: {
        where: { isActive: true },
        orderBy: { price: 'asc' },
      },
      _count: {
        select: {
          subscriptions: true,
          posts: true,
        },
      },
    },
  });
});

/**
 * Cache circle list with optimized query
 */
export const getCircles = cache(async (params: PaginationParams & {
  category?: string;
  search?: string;
  creatorId?: string;
}) => {
  const { page = 1, limit = 12, category, search, creatorId } = params;
  const skip = (page - 1) * limit;

  const where = {
    isPublic: true,
    ...(category && { category }),
    ...(creatorId && { creatorId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [circles, total] = await Promise.all([
    prisma.circle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    }),
    prisma.circle.count({ where }),
  ]);

  return {
    data: circles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + circles.length < total,
    },
  };
});

/**
 * Cache posts with cursor-based pagination for infinite scroll
 */
export const getPosts = cache(async (params: {
  circleId: string;
  cursor?: string;
  limit?: number;
  userId?: string;
}) => {
  const { circleId, cursor, limit = 10, userId } = params;

  // Check user's subscription tier for access control
  let userTier = 0;
  if (userId) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        circleId,
        status: 'ACTIVE',
      },
      include: {
        membership: true,
      },
    });
    userTier = subscription?.membership?.tier ?? 0;
  }

  const posts = await prisma.post.findMany({
    where: {
      circleId,
      OR: [
        { isPublic: true },
        { minTier: { lte: userTier } },
      ],
    },
    take: limit + 1, // Fetch one extra to check for more
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
        },
      },
    },
  });

  const hasMore = posts.length > limit;
  const data = hasMore ? posts.slice(0, -1) : posts;

  return {
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
    },
  };
});

// =============================================================================
// Parallel Data Fetching
// =============================================================================

/**
 * Fetch multiple data sources in parallel
 * Use this pattern in Server Components for optimal performance
 */
export async function fetchCirclePageData(
  circleIdOrSlug: string,
  userId?: string
) {
  const [circle, userSubscription] = await Promise.all([
    getCircle(circleIdOrSlug),
    userId
      ? prisma.subscription.findFirst({
          where: {
            userId,
            circle: {
              OR: [
                { id: circleIdOrSlug },
                { slug: circleIdOrSlug },
              ],
            },
            status: 'ACTIVE',
          },
          include: {
            membership: true,
          },
        })
      : null,
  ]);

  return {
    circle,
    userSubscription,
    isSubscribed: !!userSubscription,
    userTier: userSubscription?.membership?.tier ?? 0,
  };
}

/**
 * Fetch dashboard data for creators
 */
export async function fetchCreatorDashboardData(creatorId: string) {
  const [circles, recentSubscriptions, totalEarnings, analytics] =
    await Promise.all([
      prisma.circle.findMany({
        where: { creatorId },
        include: {
          _count: {
            select: {
              subscriptions: true,
              posts: true,
            },
          },
        },
      }),
      prisma.subscription.findMany({
        where: {
          circle: { creatorId },
          status: 'ACTIVE',
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          membership: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          circle: { creatorId },
          status: 'COMPLETED',
        },
        _sum: {
          creatorEarnings: true,
        },
      }),
      getCreatorAnalytics(creatorId),
    ]);

  return {
    circles,
    recentSubscriptions,
    totalEarnings: totalEarnings._sum.creatorEarnings ?? 0,
    analytics,
  };
}

/**
 * Get creator analytics data
 */
const getCreatorAnalytics = cache(async (creatorId: string) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [subscriptionsByDay, revenueByDay, topPosts] = await Promise.all([
    prisma.subscription.groupBy({
      by: ['createdAt'],
      where: {
        circle: { creatorId },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['createdAt'],
      where: {
        circle: { creatorId },
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: {
        creatorEarnings: true,
      },
    }),
    prisma.post.findMany({
      where: {
        circle: { creatorId },
      },
      take: 5,
      orderBy: {
        likes: {
          _count: 'desc',
        },
      },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    }),
  ]);

  return {
    subscriptionsByDay,
    revenueByDay,
    topPosts,
  };
});

// =============================================================================
// Preload Patterns
// =============================================================================

/**
 * Preload data for subsequent navigation
 * Call this in layouts to warm the cache
 */
export function preloadCircle(circleIdOrSlug: string) {
  void getCircle(circleIdOrSlug);
}

export function preloadUser(userId: string) {
  void getUser(userId);
}

// =============================================================================
// Streaming Utilities
// =============================================================================

/**
 * Create a streamable data source for Suspense boundaries
 */
export function createStreamableData<T>(
  fetcher: () => Promise<T>
): Promise<T> {
  return fetcher();
}

/**
 * Batch multiple streamable queries
 */
export async function streamBatch<T extends Record<string, Promise<unknown>>>(
  queries: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const entries = Object.entries(queries);
  const results = await Promise.all(entries.map(([, promise]) => promise));

  return Object.fromEntries(
    entries.map(([key], index) => [key, results[index]])
  ) as { [K in keyof T]: Awaited<T[K]> };
}
