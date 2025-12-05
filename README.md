# CreatorCircle

**크리에이터 구독 커뮤니티 플랫폼** - 知识星球(Knowledge Planet)과 小报童(Xiaobaotong)을 벤치마킹한 엔터프라이즈급 플랫폼

[![CI](https://github.com/josens83/CreatorCircle/actions/workflows/ci.yml/badge.svg)](https://github.com/josens83/CreatorCircle/actions/workflows/ci.yml)
[![CD](https://github.com/josens83/CreatorCircle/actions/workflows/cd.yml/badge.svg)](https://github.com/josens83/CreatorCircle/actions/workflows/cd.yml)

## Overview

CreatorCircle는 크리에이터가 유료 구독 커뮤니티를 운영할 수 있는 플랫폼입니다. Netflix, Spotify, Stripe 수준의 프로덕션 품질을 목표로 설계되었습니다.

### Key Features

- **유료 커뮤니티**: 멤버십 티어별 프리미엄 콘텐츠 제공
- **Stripe Connect**: 크리에이터 자동 정산 (플랫폼 수수료 10%)
- **실시간 분석**: 구독자, 수익, 콘텐츠 성과 대시보드
- **보안**: OWASP 표준, 암호화, Rate Limiting

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 14, React 19, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js API Routes, Prisma, PostgreSQL |
| **Payments** | Stripe Connect |
| **Auth** | NextAuth.js, OAuth 2.0 |
| **Testing** | Vitest, Playwright, k6 |
| **CI/CD** | GitHub Actions, Docker |
| **Monitoring** | Sentry, Prometheus |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+
- Docker (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/josens83/CreatorCircle.git
cd CreatorCircle

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Setup database
pnpm db:generate
pnpm db:push

# Start development server
pnpm dev
```

### Using Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## Documentation

| Document | Description |
|----------|-------------|
| [API Documentation](docs/API.md) | REST API 엔드포인트 가이드 |
| [Architecture](docs/ARCHITECTURE.md) | 시스템 아키텍처 및 설계 결정 |
| [Development Guide](docs/DEVELOPMENT.md) | 개발 환경 설정 및 코드 패턴 |
| [Deployment Guide](docs/DEPLOYMENT.md) | 프로덕션 배포 가이드 |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── features/         # Feature components
├── lib/                   # Core libraries
│   ├── errors/           # Error handling
│   ├── monitoring/       # Logging, metrics
│   ├── payments/         # Stripe integration
│   ├── performance/      # Optimization utilities
│   ├── resilience/       # Circuit breaker, retry
│   └── security/         # Auth, rate limiting
└── tests/                # Test suites
```

## Enterprise Features

### Resilience

- **Circuit Breaker**: Netflix Hystrix 패턴
- **Retry with Backoff**: 지수 백오프 + 지터
- **Graceful Degradation**: SWR 캐싱 폴백

### Security

- **Rate Limiting**: Sliding Window 알고리즘
- **Input Validation**: Zod 스키마 검증
- **Security Headers**: CSP, HSTS, X-Frame-Options
- **Audit Logging**: SHA-256 무결성 검증

### Observability

- **Structured Logging**: JSON 포맷, 컨텍스트 추적
- **Prometheus Metrics**: HTTP, DB, 비즈니스 메트릭
- **Health Checks**: Kubernetes 호환 프로브

### Performance

- **React Server Components**: 서버 사이드 데이터 페칭
- **SWR Caching**: Stale-While-Revalidate 패턴
- **Image Optimization**: WebP/AVIF, Lazy Loading
- **Database Optimization**: 커서 페이지네이션, 쿼리 모니터링

## Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema changes
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio

# Testing
pnpm test             # Run unit tests (watch)
pnpm test:run         # Run unit tests (once)
pnpm test:coverage    # Generate coverage report
pnpm test:e2e         # Run E2E tests
pnpm test:load        # Run load tests

# Quality
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript check
```

## Environment Variables

See [`.env.example`](.env.example) for all available options.

### Required

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ for creators worldwide
