# CreatorCircle Architecture

## System Overview

CreatorCircle는 크리에이터가 유료 구독 커뮤니티를 운영할 수 있는 플랫폼입니다. Netflix, Spotify, Stripe 수준의 엔터프라이즈급 아키텍처를 목표로 설계되었습니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CreatorCircle                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Client    │    │   CDN       │    │   Nginx     │    │   Next.js   │  │
│  │  (Browser)  │───▶│(CloudFlare) │───▶│(Reverse     │───▶│   (App)     │  │
│  │             │    │             │    │  Proxy)     │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘  │
│                                                                   │         │
│                     ┌─────────────────────────────────────────────┤         │
│                     │                                             │         │
│                     ▼                                             ▼         │
│  ┌─────────────────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │      PostgreSQL         │    │    Redis    │    │       Stripe        │ │
│  │      (Database)         │    │   (Cache)   │    │     (Payments)      │ │
│  └─────────────────────────┘    └─────────────┘    └─────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 14 | React 풀스택 프레임워크 |
| React 19 | UI 라이브러리 |
| Tailwind CSS | 스타일링 |
| shadcn/ui | UI 컴포넌트 |
| TanStack Query | 서버 상태 관리 |
| Zustand | 클라이언트 상태 관리 |

### Backend
| Technology | Purpose |
|------------|---------|
| Next.js API Routes | REST API |
| Prisma | ORM |
| PostgreSQL | 주 데이터베이스 |
| Redis | 캐싱, Rate Limiting |
| NextAuth.js | 인증 |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | 컨테이너화 |
| Nginx | 리버스 프록시 |
| GitHub Actions | CI/CD |
| Sentry | 에러 트래킹 |
| Prometheus | 메트릭 수집 |

### External Services
| Service | Purpose |
|---------|---------|
| Stripe Connect | 결제 및 정산 |
| Cloudflare | CDN, DDoS 보호 |
| AWS S3 / Cloudflare R2 | 파일 저장 |
| Resend | 이메일 발송 |

---

## Application Architecture

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 관련 페이지
│   ├── (dashboard)/       # 대시보드 페이지
│   ├── (marketing)/       # 마케팅 페이지
│   ├── api/               # API 라우트
│   └── layout.tsx         # 루트 레이아웃
│
├── components/            # React 컴포넌트
│   ├── ui/               # 기본 UI 컴포넌트 (shadcn)
│   ├── forms/            # 폼 컴포넌트
│   ├── layouts/          # 레이아웃 컴포넌트
│   └── features/         # 기능별 컴포넌트
│
├── lib/                   # 라이브러리 및 유틸리티
│   ├── api/              # API 핸들러 유틸리티
│   ├── errors/           # 에러 클래스
│   ├── monitoring/       # 로깅, 메트릭, 헬스체크
│   ├── payments/         # 결제 로직
│   ├── performance/      # 성능 최적화
│   ├── resilience/       # 서킷브레이커, 재시도
│   ├── security/         # 보안 유틸리티
│   └── prisma.ts         # Prisma 클라이언트
│
├── hooks/                 # React 훅
├── stores/               # Zustand 스토어
├── types/                # TypeScript 타입
└── tests/                # 테스트
```

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (React Components, Pages, Layouts)                         │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  (API Routes, Server Actions, Business Logic)               │
├─────────────────────────────────────────────────────────────┤
│                    Domain Layer                              │
│  (Entities, Value Objects, Domain Services)                 │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  (Database, External APIs, Caching)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Core Entities

```
User
├── id
├── email
├── name
├── image
├── role (USER | CREATOR | ADMIN)
├── circles[] (owned)
└── subscriptions[]

Circle
├── id
├── name
├── slug
├── description
├── creator
├── memberships[]
├── posts[]
└── subscriptions[]

Membership
├── id
├── name
├── price
├── tier
├── benefits[]
└── circle

Subscription
├── id
├── user
├── circle
├── membership
├── status
├── stripeSubscriptionId
└── currentPeriod

Post
├── id
├── title
├── content
├── circle
├── author
├── isPublic
├── minTier
├── comments[]
└── likes[]

Transaction
├── id
├── type
├── amount
├── platformFee
├── stripeFee
├── creatorEarnings
└── status
```

### Entity Relationships

```
User 1──────N Circle (creator)
User 1──────N Subscription
Circle 1────N Membership
Circle 1────N Post
Circle 1────N Subscription
Membership 1─N Subscription
Post 1──────N Comment
Post 1──────N Like
Transaction N─1 User
Transaction N─1 Circle
```

---

## Security Architecture

### Authentication Flow

```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────┐
│ Client  │───▶│  NextAuth   │───▶│   OAuth     │───▶│ Provider│
│         │◀───│   Session   │◀───│   Callback  │◀───│ (Google)│
└─────────┘    └─────────────┘    └─────────────┘    └─────────┘
                     │
                     ▼
              ┌─────────────┐
              │   JWT/DB    │
              │   Session   │
              └─────────────┘
```

### Security Layers

1. **Transport Layer**: TLS 1.3, HSTS
2. **Application Layer**: CSP, XSS Prevention, CSRF Protection
3. **Authentication**: OAuth 2.0, Session Management
4. **Authorization**: Role-based Access Control (RBAC)
5. **Data Layer**: Input Validation, SQL Injection Prevention
6. **Rate Limiting**: Sliding Window Algorithm

### Security Headers

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'...
Strict-Transport-Security: max-age=63072000
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Resilience Patterns

### Circuit Breaker

```
┌─────────────────────────────────────────────────────────────┐
│                    Circuit Breaker States                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐   failure   ┌─────────┐   timeout  ┌─────────┐ │
│  │ CLOSED  │────────────▶│  OPEN   │───────────▶│HALF-OPEN│ │
│  └────┬────┘             └────┬────┘            └────┬────┘ │
│       │                       │                      │      │
│       │ success              │ reject              │       │
│       │◀─────────────────────┴──────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Retry with Exponential Backoff

```typescript
delay = baseDelay * (2 ^ attemptNumber) + jitter
```

### Fallback Strategy

1. Primary: Fresh data from service
2. Fallback: Cached data (SWR)
3. Fallback: Default/Static data
4. Final: Graceful degradation

---

## Payment Architecture

### Payment Flow

```
┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────────┐
│ Client  │───▶│  CreatorCircle  │───▶│ Stripe  │───▶│   Bank      │
└─────────┘    └─────────────┘    └─────────┘    └─────────────┘
     │               │                  │
     │               │  Webhook         │
     │               │◀─────────────────┘
     │               │
     ▼               ▼
┌───────────────────────────────────────────────────────────────┐
│                    Transaction Processing                      │
│  1. Validate webhook signature                                │
│  2. Idempotency check                                         │
│  3. Process payment event                                     │
│  4. Update database (transaction)                             │
│  5. Send notifications                                        │
└───────────────────────────────────────────────────────────────┘
```

### Fee Structure

```
총 결제금액: ₩10,000
├── Stripe 수수료: ₩740 (3.4% + ₩400)
├── 플랫폼 수수료: ₩926 (10%)
└── 크리에이터 수익: ₩8,334
```

### Reconciliation

- 일별 정산: Stripe와 DB 간 트랜잭션 대조
- 월별 리포트: 수익 리포트 생성
- 불일치 감지: 자동 알림 및 조사

---

## Caching Strategy

### Cache Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      Cache Hierarchy                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  L1: React Cache (Request Deduplication)                    │
│      └── Request-scoped, Server Components                  │
│                                                              │
│  L2: In-Memory Cache (SWR Pattern)                          │
│      └── Application-level, TTL + Stale-While-Revalidate   │
│                                                              │
│  L3: Redis (Distributed Cache)                              │
│      └── Shared across instances, Session/Rate Limit        │
│                                                              │
│  L4: CDN (Edge Cache)                                        │
│      └── Static assets, API responses                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Cache Invalidation

| Strategy | Use Case |
|----------|----------|
| TTL-based | 시간 기반 만료 |
| Tag-based | 관련 데이터 일괄 무효화 |
| Event-driven | 데이터 변경 시 즉시 무효화 |

---

## Monitoring & Observability

### Metrics (Prometheus)

```
# HTTP 요청
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}

# 데이터베이스
db_queries_total{operation, table}
db_query_duration_seconds{operation}

# 비즈니스 메트릭
payments_total{type, status}
subscriptions_total{status}
```

### Logging (Structured)

```json
{
  "level": "info",
  "time": 1699900000000,
  "msg": "Payment processed",
  "context": {
    "requestId": "req_abc123",
    "userId": "user_xyz",
    "amount": 29900
  }
}
```

### Tracing (Sentry)

- Transaction tracing
- Error tracking with context
- Performance monitoring

---

## Deployment Architecture

### Blue-Green Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx                                │
│                    (Load Balancer)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│   App Blue      │             │   App Green     │
│   (Active)      │             │   (Standby)     │
└─────────────────┘             └─────────────────┘
         │                               │
         └───────────────┬───────────────┘
                         ▼
              ┌─────────────────┐
              │   PostgreSQL    │
              │   (Primary)     │
              └─────────────────┘
```

### Rollback Strategy

1. Health check 실패 감지
2. 이전 버전 이미지로 롤백
3. Slack 알림 발송
4. 로그 분석 및 원인 파악

---

## Scalability Considerations

### Horizontal Scaling

- Stateless application design
- Session storage in Redis
- Database connection pooling

### Vertical Scaling

- Resource limits per container
- Auto-scaling based on metrics

### Database Scaling

- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Query optimization & indexing

---

## Future Considerations

1. **Microservices**: Payment, Notification 서비스 분리
2. **Event Sourcing**: 결제 이력 관리
3. **GraphQL**: 복잡한 데이터 요청 최적화
4. **Edge Functions**: 글로벌 지연시간 최적화
5. **AI Features**: 콘텐츠 추천, 자동 모더레이션
