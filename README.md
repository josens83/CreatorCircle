# CreatorCircle - 크리에이터 구독 커뮤니티 플랫폼

知识星球(Knowledge Planet)과 小报童(Xiaobaotong)을 벤치마킹한 크리에이터 구독 커뮤니티 플랫폼입니다.

## 핵심 기능

- **유료 커뮤니티**: 멤버십 티어로 프리미엄 콘텐츠 제공
- **뉴스레터**: 이메일로 구독자에게 직접 전달
- **디지털 상품**: 이북, 템플릿, 강의 판매
- **제휴 시스템**: 60% 커미션으로 바이럴 성장

## 수익 모델

- 플랫폼 수수료: 10% (업계 최저)
- 크리에이터 수익: 90%
- 팁 수수료: 5%

## 기술 스택

### Frontend
- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui
- Zustand + TanStack Query
- TypeScript

### Backend
- Next.js API Routes
- Prisma ORM
- PostgreSQL

### Payments
- Stripe (글로벌)
- Stripe Connect (크리에이터 정산)

### Authentication
- NextAuth.js
- Google/GitHub OAuth

## 시작하기

### 필수 요구사항
- Node.js 18+
- PostgreSQL 데이터베이스
- Stripe 계정

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 필요한 값 입력

# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 마이그레이션
npm run db:push

# 개발 서버 시작
npm run dev
```

### 환경 변수

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"

# OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe
STRIPE_PUBLIC_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 관련 페이지
│   ├── (main)/            # 메인 페이지들
│   ├── api/               # API 라우트
│   └── creator/           # 크리에이터 대시보드
├── components/
│   ├── ui/                # shadcn/ui 컴포넌트
│   ├── layout/            # 레이아웃 컴포넌트
│   └── ...                # 기능별 컴포넌트
├── lib/                   # 유틸리티 함수
├── hooks/                 # React 훅
├── stores/                # Zustand 스토어
└── types/                 # TypeScript 타입
```

## 주요 페이지

- `/` - 홈페이지
- `/explore` - 서클 탐색
- `/circle/[slug]` - 서클 상세
- `/login` - 로그인
- `/signup` - 회원가입
- `/become-creator` - 크리에이터 등록
- `/creator/dashboard` - 크리에이터 대시보드

## API 엔드포인트

### 인증
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/[...nextauth]` - NextAuth.js

### 서클
- `GET /api/circles` - 서클 목록
- `POST /api/circles` - 서클 생성
- `GET /api/circles/[slug]` - 서클 상세

### 포스트
- `GET /api/posts` - 포스트 목록
- `POST /api/posts` - 포스트 생성

### 크리에이터
- `POST /api/creators/onboard` - 크리에이터 등록

### Webhooks
- `POST /api/webhooks/stripe` - Stripe 웹훅

## 라이선스

MIT License
