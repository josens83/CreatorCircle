# CreatorCircle API Documentation

## Overview

CreatorCircle API는 RESTful 원칙을 따르며, JSON 형식으로 데이터를 주고받습니다.

### Base URL

```
Production: https://api.creatorcircle.io
Staging: https://staging-api.creatorcircle.io
Development: http://localhost:3000
```

### Authentication

API 요청은 NextAuth.js 세션 기반 인증을 사용합니다. 프로그래밍 방식 접근 시 API 키를 사용할 수 있습니다.

```http
Authorization: Bearer <api_key>
```

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| General | 100 req | 1 min |
| Auth | 5 req | 1 min |
| Payment | 10 req | 1 min |

Rate limit 초과 시 `429 Too Many Requests` 응답과 함께 `Retry-After` 헤더가 반환됩니다.

---

## Endpoints

### Health Check

#### GET /api/health

서버 상태 확인

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| probe | string | `liveness`, `readiness`, `startup` |

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1699900000000,
  "version": "1.0.0",
  "uptime": 86400,
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "latency": 5
    }
  ]
}
```

---

### Authentication

#### POST /api/auth/register

신규 사용자 등록

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "홍길동"
}
```

**Response:** `201 Created`
```json
{
  "id": "user_abc123",
  "email": "user@example.com",
  "name": "홍길동",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors:**
| Code | Description |
|------|-------------|
| 400 | 유효성 검사 실패 |
| 409 | 이메일 중복 |

#### POST /api/auth/signin

로그인 (NextAuth.js credentials)

#### GET /api/auth/session

현재 세션 정보 조회

---

### Users

#### GET /api/users/me

현재 로그인한 사용자 정보

**Response:**
```json
{
  "id": "user_abc123",
  "email": "user@example.com",
  "name": "홍길동",
  "image": "https://...",
  "role": "USER",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "stats": {
    "circlesOwned": 2,
    "subscriptions": 5
  }
}
```

#### PATCH /api/users/me

사용자 정보 수정

**Request Body:**
```json
{
  "name": "새 이름",
  "image": "https://..."
}
```

---

### Circles

#### GET /api/circles

써클 목록 조회

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | 페이지 번호 |
| limit | number | 12 | 페이지당 항목 수 |
| category | string | - | 카테고리 필터 |
| search | string | - | 검색어 |
| sort | string | createdAt:desc | 정렬 (createdAt, subscriberCount) |

**Response:**
```json
{
  "circles": [
    {
      "id": "circle_abc123",
      "name": "크리에이터 써클",
      "slug": "creator-circle",
      "description": "크리에이터를 위한 커뮤니티",
      "image": "https://...",
      "isPublic": true,
      "creator": {
        "id": "user_xyz",
        "name": "크리에이터",
        "image": "https://..."
      },
      "_count": {
        "subscriptions": 150
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 50,
    "totalPages": 5,
    "hasMore": true
  }
}
```

#### POST /api/circles

새 써클 생성 (크리에이터 전용)

**Request Body:**
```json
{
  "name": "내 써클",
  "slug": "my-circle",
  "description": "써클 설명",
  "category": "TECH",
  "isPublic": true
}
```

**Response:** `201 Created`

#### GET /api/circles/:id

써클 상세 정보

**Response:**
```json
{
  "id": "circle_abc123",
  "name": "크리에이터 써클",
  "slug": "creator-circle",
  "description": "크리에이터를 위한 커뮤니티",
  "image": "https://...",
  "bannerImage": "https://...",
  "isPublic": true,
  "category": "TECH",
  "creator": {
    "id": "user_xyz",
    "name": "크리에이터",
    "image": "https://...",
    "bio": "크리에이터 소개"
  },
  "memberships": [
    {
      "id": "membership_1",
      "name": "Basic",
      "description": "기본 멤버십",
      "price": 9900,
      "benefits": ["전체 게시물 열람", "댓글 작성"]
    }
  ],
  "_count": {
    "subscriptions": 150,
    "posts": 45
  },
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### PATCH /api/circles/:id

써클 정보 수정 (소유자 전용)

#### DELETE /api/circles/:id

써클 삭제 (소유자 전용)

---

### Memberships

#### GET /api/circles/:circleId/memberships

멤버십 티어 목록

#### POST /api/circles/:circleId/memberships

멤버십 티어 생성 (소유자 전용)

**Request Body:**
```json
{
  "name": "Premium",
  "description": "프리미엄 멤버십",
  "price": 29900,
  "tier": 2,
  "benefits": [
    "모든 Basic 혜택",
    "1:1 질문 답변",
    "월간 라이브 세션"
  ]
}
```

---

### Subscriptions

#### GET /api/subscriptions

내 구독 목록

**Response:**
```json
{
  "subscriptions": [
    {
      "id": "sub_abc123",
      "status": "ACTIVE",
      "currentPeriodStart": "2024-01-01T00:00:00.000Z",
      "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
      "circle": {
        "id": "circle_xyz",
        "name": "크리에이터 써클",
        "slug": "creator-circle"
      },
      "membership": {
        "id": "membership_1",
        "name": "Premium",
        "price": 29900
      }
    }
  ]
}
```

#### POST /api/circles/:circleId/subscribe

써클 구독

**Request Body:**
```json
{
  "membershipId": "membership_1",
  "paymentMethodId": "pm_xxx"
}
```

**Response:**
```json
{
  "subscriptionId": "sub_abc123",
  "clientSecret": "pi_xxx_secret_xxx",
  "status": "requires_action"
}
```

#### DELETE /api/subscriptions/:id

구독 취소

---

### Posts

#### GET /api/circles/:circleId/posts

게시물 목록 (커서 기반 페이지네이션)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| cursor | string | 커서 (마지막 게시물 ID) |
| limit | number | 항목 수 (기본 10) |

**Response:**
```json
{
  "posts": [
    {
      "id": "post_abc123",
      "title": "게시물 제목",
      "content": "게시물 내용...",
      "excerpt": "요약...",
      "isPublic": false,
      "minTier": 1,
      "author": {
        "id": "user_xyz",
        "name": "크리에이터"
      },
      "_count": {
        "comments": 10,
        "likes": 50
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": "post_xyz789",
  "hasMore": true
}
```

#### POST /api/circles/:circleId/posts

게시물 작성 (소유자 전용)

**Request Body:**
```json
{
  "title": "새 게시물",
  "content": "게시물 내용...",
  "isPublic": false,
  "minTier": 1
}
```

#### GET /api/posts/:id

게시물 상세

#### PATCH /api/posts/:id

게시물 수정

#### DELETE /api/posts/:id

게시물 삭제

---

### Comments

#### GET /api/posts/:postId/comments

댓글 목록

#### POST /api/posts/:postId/comments

댓글 작성

**Request Body:**
```json
{
  "content": "댓글 내용",
  "parentId": "comment_parent" // 답글인 경우
}
```

---

### Payments

#### GET /api/payments/history

결제 내역

**Response:**
```json
{
  "transactions": [
    {
      "id": "txn_abc123",
      "type": "SUBSCRIPTION",
      "amount": 29900,
      "status": "COMPLETED",
      "circle": {
        "name": "크리에이터 써클"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/payments/setup-intent

결제 수단 등록용 SetupIntent 생성

---

### Webhooks

#### POST /api/webhooks/stripe

Stripe 웹훅 엔드포인트

**Handled Events:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

---

### Creator Dashboard

#### GET /api/creator/dashboard

크리에이터 대시보드 데이터

**Response:**
```json
{
  "stats": {
    "totalSubscribers": 150,
    "monthlyRevenue": 2500000,
    "totalEarnings": 15000000,
    "postsCount": 45
  },
  "recentSubscriptions": [...],
  "revenueChart": [
    { "date": "2024-01", "revenue": 2000000 }
  ]
}
```

#### GET /api/creator/analytics

상세 분석 데이터

---

## Error Responses

모든 에러는 일관된 형식으로 반환됩니다:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값이 올바르지 않습니다",
    "details": {
      "email": "유효한 이메일 주소를 입력해주세요"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | 입력값 유효성 검사 실패 |
| UNAUTHORIZED | 401 | 인증 필요 |
| FORBIDDEN | 403 | 권한 없음 |
| NOT_FOUND | 404 | 리소스를 찾을 수 없음 |
| CONFLICT | 409 | 리소스 충돌 |
| RATE_LIMIT_EXCEEDED | 429 | 요청 한도 초과 |
| PAYMENT_ERROR | 402 | 결제 실패 |
| INTERNAL_ERROR | 500 | 서버 내부 오류 |

---

## Pagination

### Offset-based Pagination

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasMore": true
  }
}
```

### Cursor-based Pagination

무한 스크롤에 권장:

```json
{
  "data": [...],
  "nextCursor": "abc123",
  "hasMore": true
}
```

---

## Versioning

API 버전은 헤더로 지정합니다:

```http
Accept: application/json; version=1
```

현재 버전: `1` (default)
