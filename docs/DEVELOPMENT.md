# CreatorCircle Developer Guide

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Quick Start

```bash
# 저장소 클론
git clone https://github.com/josens83/CreatorCircle.git
cd CreatorCircle

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 필요한 값 입력

# 데이터베이스 설정
pnpm db:generate
pnpm db:push

# 개발 서버 실행
pnpm dev
```

### Docker로 시작하기

```bash
# 모든 서비스 시작 (PostgreSQL, Redis 포함)
docker-compose up -d

# 로그 확인
docker-compose logs -f app

# 종료
docker-compose down
```

---

## Project Structure

```
CreatorCircle/
├── .github/              # GitHub Actions 워크플로우
├── docs/                 # 문서
├── e2e/                  # E2E 테스트 (Playwright)
├── k6/                   # 부하 테스트
├── nginx/                # Nginx 설정
├── prisma/               # Prisma 스키마 및 마이그레이션
├── public/               # 정적 파일
├── scripts/              # 유틸리티 스크립트
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React 컴포넌트
│   ├── hooks/            # React 훅
│   ├── lib/              # 라이브러리
│   ├── stores/           # Zustand 스토어
│   ├── tests/            # 유닛 테스트
│   └── types/            # TypeScript 타입
└── ...config files
```

---

## Development Workflow

### Branch Strategy

```
main          # 프로덕션 배포
develop       # 개발 통합 브랜치
feature/*     # 기능 개발
bugfix/*      # 버그 수정
hotfix/*      # 긴급 수정
```

### Commit Convention

```
feat: 새로운 기능
fix: 버그 수정
docs: 문서 변경
style: 코드 스타일 변경
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드/도구 변경
```

### Code Review Checklist

- [ ] 테스트 통과
- [ ] 타입 에러 없음
- [ ] ESLint 규칙 준수
- [ ] 보안 취약점 없음
- [ ] 성능 고려
- [ ] 문서 업데이트

---

## Code Patterns

### API Route Handler

```typescript
// src/app/api/example/route.ts
import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { z } from 'zod';

const RequestSchema = z.object({
  name: z.string().min(1),
});

export const POST = apiHandler(
  async (req, ctx) => {
    const body = await req.json();
    const { name } = RequestSchema.parse(body);

    // 비즈니스 로직
    const result = await doSomething(name);

    return NextResponse.json(result, { status: 201 });
  },
  { requireAuth: true }
);
```

### Server Component Data Fetching

```typescript
// src/app/circles/[slug]/page.tsx
import { getCircle } from '@/lib/performance/server-fetch';

export default async function CirclePage({
  params
}: {
  params: { slug: string }
}) {
  const circle = await getCircle(params.slug);

  if (!circle) {
    notFound();
  }

  return <CircleDetail circle={circle} />;
}
```

### Client Component with TanStack Query

```typescript
// src/components/features/posts/PostList.tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function PostList({ circleId }: { circleId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['posts', circleId],
    queryFn: () => fetchPosts(circleId),
  });

  if (isLoading) return <PostListSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {data.posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </ul>
  );
}
```

### Error Handling

```typescript
import { AppError, ValidationError, NotFoundError } from '@/lib/errors';

// 에러 발생
throw new ValidationError('잘못된 입력입니다', {
  email: '유효한 이메일을 입력하세요',
});

throw new NotFoundError('Circle', circleId);

// 에러 처리
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof AppError && error.isOperational) {
    // 예상된 에러 - 사용자에게 표시
    return handleOperationalError(error);
  }
  // 예상치 못한 에러 - 로깅 후 일반 메시지
  logger.error('Unexpected error', error);
  throw error;
}
```

### Resilience Patterns

```typescript
import { stripeCircuit } from '@/lib/resilience/circuit-breaker';
import { stripeRetrier } from '@/lib/resilience/retry';

// 서킷 브레이커 사용
const result = await stripeCircuit.execute(
  () => stripe.customers.create({ email }),
  () => getCachedCustomer(email) // fallback
);

// 재시도 사용
const customer = await stripeRetrier.execute(() =>
  stripe.customers.retrieve(customerId)
);
```

### Database Queries

```typescript
import { prisma } from '@/lib/prisma';
import { measureQuery, cursorPaginate } from '@/lib/performance/database';

// 성능 측정 포함 쿼리
const users = await measureQuery('findMany', 'user', () =>
  prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, email: true },
    take: 100,
  })
);

// 커서 기반 페이지네이션
const { data, nextCursor, hasMore } = await cursorPaginate(
  'post',
  { circleId, isPublic: true },
  { cursor, limit: 20, orderBy: { createdAt: 'desc' } }
);
```

---

## Testing

### Unit Tests (Vitest)

```bash
# 테스트 실행 (watch 모드)
pnpm test

# 단일 실행
pnpm test:run

# 커버리지 리포트
pnpm test:coverage
```

```typescript
// src/tests/unit/example.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateFee } from '@/lib/payments';

describe('calculateFee', () => {
  it('should calculate platform fee correctly', () => {
    const result = calculateFee(10000);
    expect(result.platformFee).toBe(926);
    expect(result.creatorEarnings).toBe(8334);
  });
});
```

### E2E Tests (Playwright)

```bash
# E2E 테스트 실행
pnpm test:e2e

# UI 모드
pnpm test:e2e:ui

# 특정 브라우저
pnpm test:e2e --project=chromium
```

```typescript
// e2e/circles.spec.ts
import { test, expect } from '@playwright/test';

test('should display circle list', async ({ page }) => {
  await page.goto('/circles');

  await expect(page.getByRole('heading', { name: /써클/ })).toBeVisible();
  await expect(page.getByTestId('circle-card')).toHaveCount.greaterThan(0);
});
```

### Load Tests (k6)

```bash
# 부하 테스트 실행
pnpm test:load

# API 테스트
pnpm test:load:api
```

---

## Database

### Prisma Commands

```bash
# 클라이언트 생성
pnpm db:generate

# 스키마 푸시 (개발용)
pnpm db:push

# 마이그레이션 생성
pnpm db:migrate

# Prisma Studio 실행
pnpm db:studio
```

### Schema Changes

1. `prisma/schema.prisma` 수정
2. `pnpm db:migrate` 실행
3. 마이그레이션 이름 입력
4. 생성된 마이그레이션 파일 확인

### Seeding

```typescript
// prisma/seed.ts
import { prisma } from '../src/lib/prisma';

async function main() {
  // 테스트 데이터 생성
  await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
    },
  });
}

main();
```

```bash
pnpm db:seed
```

---

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Optional Variables

```bash
# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Redis (caching)
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=
```

---

## Debugging

### VSCode Launch Configuration

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### Logging

```typescript
import { logger } from '@/lib/monitoring/logger';

// 개발 환경에서 Pretty 출력
logger.info('Processing payment', {
  userId,
  amount,
  circleId
});

logger.error('Payment failed', error, {
  userId,
  paymentIntentId
});
```

### Database Debugging

```bash
# Prisma 쿼리 로그 활성화
DEBUG="prisma:query" pnpm dev

# 또는 .env.local에 추가
DEBUG=prisma:query
```

---

## Performance Optimization

### Server Components

- 가능한 모든 곳에서 Server Components 사용
- 클라이언트 컴포넌트는 `'use client'` 명시
- 데이터 페칭은 Server Components에서

### Image Optimization

```typescript
import { getOptimizedImageUrl, getAvatarConfig } from '@/lib/performance/image';

// 최적화된 이미지 URL
const imageUrl = getOptimizedImageUrl(src, {
  width: 400,
  quality: 80,
  format: 'webp',
});

// 아바타 설정
const avatar = getAvatarConfig(user.image, user.name, 'md');
```

### Caching

```typescript
import { apiCache, CACHE_PRESETS } from '@/lib/performance/cache';

// SWR 패턴 캐싱
const data = await apiCache.getOrFetch(
  `circle:${circleId}`,
  () => fetchCircle(circleId),
  CACHE_PRESETS.user
);
```

---

## Troubleshooting

### Common Issues

**문제: Prisma 클라이언트 타입 에러**
```bash
pnpm db:generate
```

**문제: 포트 충돌**
```bash
lsof -i :3000
kill -9 <PID>
```

**문제: Docker 볼륨 문제**
```bash
docker-compose down -v
docker-compose up -d
```

**문제: 의존성 충돌**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Stripe Documentation](https://stripe.com/docs)
