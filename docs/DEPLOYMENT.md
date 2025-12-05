# CreatorCircle Deployment Guide

## Overview

이 가이드는 CreatorCircle을 프로덕션 환경에 배포하는 방법을 설명합니다.

### Deployment Options

1. **Docker + VPS** (권장)
2. **Vercel** (간편 배포)
3. **Kubernetes** (대규모)

---

## Prerequisites

### Required Services

| Service | Purpose | Provider Options |
|---------|---------|------------------|
| PostgreSQL | Database | AWS RDS, Supabase, Railway |
| Redis | Cache | Upstash, Railway, ElastiCache |
| Stripe | Payments | stripe.com |
| Email | Notifications | Resend, SendGrid |
| Storage | File uploads | S3, Cloudflare R2 |

### Required Secrets

```bash
# Authentication
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
RESEND_API_KEY=re_...
```

---

## Option 1: Docker + VPS

### 1. Server Setup

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo apt install docker-compose-plugin
```

### 2. SSL Certificate

```bash
# Certbot 설치
sudo apt install certbot

# 인증서 발급
sudo certbot certonly --standalone -d creatorcircle.io -d www.creatorcircle.io

# 인증서 복사
sudo cp /etc/letsencrypt/live/creatorcircle.io/fullchain.pem /opt/creatorcircle/nginx/ssl/
sudo cp /etc/letsencrypt/live/creatorcircle.io/privkey.pem /opt/creatorcircle/nginx/ssl/
```

### 3. Deploy Application

```bash
# 프로젝트 디렉토리 생성
sudo mkdir -p /opt/creatorcircle
cd /opt/creatorcircle

# 코드 클론
git clone https://github.com/josens83/CreatorCircle.git .

# 환경 변수 설정
cp .env.example .env
nano .env  # 프로덕션 값 입력

# 배포
export IMAGE_TAG=latest
docker-compose -f docker-compose.prod.yml up -d

# 상태 확인
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Database Migration

```bash
docker-compose -f docker-compose.prod.yml exec app pnpm db:migrate
```

### 5. Health Check

```bash
curl -f https://creatorcircle.io/api/health
```

---

## Option 2: Vercel

### 1. Connect Repository

1. [vercel.com](https://vercel.com)에서 GitHub 저장소 연결
2. "Import Project" 클릭
3. CreatorCircle 저장소 선택

### 2. Environment Variables

Vercel 대시보드에서 다음 환경 변수 설정:

```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

### 3. Deploy

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

### 4. Custom Domain

1. Vercel 대시보드 → Settings → Domains
2. 도메인 추가
3. DNS 설정 (CNAME 또는 A 레코드)

---

## Option 3: Kubernetes

### 1. Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: creatorcircle
spec:
  replicas: 3
  selector:
    matchLabels:
      app: creatorcircle
  template:
    metadata:
      labels:
        app: creatorcircle
    spec:
      containers:
      - name: app
        image: ghcr.io/josens83/creatorcircle:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: creatorcircle-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health?probe=liveness
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health?probe=readiness
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: creatorcircle
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: creatorcircle
```

### 2. Deploy to Kubernetes

```bash
kubectl apply -f k8s/
kubectl get pods -w
```

---

## Database Setup

### PostgreSQL (AWS RDS)

1. RDS 인스턴스 생성 (PostgreSQL 15)
2. VPC 보안 그룹 설정
3. 연결 문자열 생성

```
DATABASE_URL=postgresql://username:password@hostname:5432/creatorcircle?sslmode=require
```

### PostgreSQL (Supabase)

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. Settings → Database → Connection String 복사
3. `[YOUR-PASSWORD]` 부분 실제 비밀번호로 교체

### Migration 실행

```bash
# 프로덕션 DB에 마이그레이션 적용
DATABASE_URL=<production_url> pnpm db:migrate

# 또는 Docker 내에서
docker-compose -f docker-compose.prod.yml run --rm app pnpm db:migrate
```

---

## Stripe Configuration

### 1. Stripe Dashboard 설정

1. [dashboard.stripe.com](https://dashboard.stripe.com)
2. API 키 복사 (Live mode)
3. Webhook 설정

### 2. Webhook 설정

1. Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://creatorcircle.io/api/webhooks/stripe`
3. 이벤트 선택:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`

### 3. Connect 설정 (정산용)

1. Settings → Connect settings
2. Express 계정 활성화
3. Branding 설정

---

## Monitoring Setup

### Sentry

1. [sentry.io](https://sentry.io)에서 프로젝트 생성
2. DSN 복사
3. 환경 변수 설정:

```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=creatorcircle
```

### Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'creatorcircle'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
    basic_auth:
      username: metrics
      password: ${METRICS_PASSWORD}
```

---

## Backup Strategy

### Database Backup

```bash
# 수동 백업
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U creatorcircle creatorcircle | gzip > backup_$(date +%Y%m%d).sql.gz

# 자동 백업 (cron)
0 2 * * * /opt/creatorcircle/scripts/backup.sh
```

### Backup Retention

- 일별 백업: 7일 보관
- 주별 백업: 4주 보관
- 월별 백업: 12개월 보관

### S3 Backup Upload

```bash
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://creatorcircle-backups/
```

---

## CI/CD Pipeline

### GitHub Secrets 설정

Repository Settings → Secrets에 추가:

```
# Docker Registry
GITHUB_TOKEN (자동 제공)

# Staging Server
STAGING_HOST=staging.creatorcircle.io
STAGING_USER=deploy
STAGING_SSH_KEY=<private-key>

# Production Server
PRODUCTION_HOST=creatorcircle.io
PRODUCTION_USER=deploy
PRODUCTION_SSH_KEY=<private-key>

# Application
DATABASE_URL=...
NEXTAUTH_SECRET=...
STRIPE_SECRET_KEY=...
...

# Notifications
SLACK_WEBHOOK_URL=...
SENTRY_AUTH_TOKEN=...
```

### Deployment Flow

```
Push to main
    ↓
CI: Lint → Test → Build
    ↓
CD: Build Image → Push to Registry
    ↓
Deploy to Staging
    ↓
Health Check
    ↓
Deploy to Production (on release)
    ↓
Health Check → Slack Notification
```

---

## Scaling

### Horizontal Scaling

```bash
# Docker Compose
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Kubernetes
kubectl scale deployment creatorcircle --replicas=5
```

### Database Connection Pooling

```bash
# PgBouncer 사용
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/creatorcircle?pgbouncer=true
```

### CDN Setup

1. Cloudflare 계정 생성
2. 도메인 DNS 설정
3. SSL/TLS → Full (strict)
4. Caching → Standard
5. Page Rules 설정

---

## Troubleshooting

### Container Not Starting

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs app

# 컨테이너 쉘 접속
docker-compose -f docker-compose.prod.yml exec app sh
```

### Database Connection Failed

```bash
# 연결 테스트
docker-compose -f docker-compose.prod.yml exec app \
  pnpm exec prisma db execute --stdin <<< "SELECT 1"

# 네트워크 확인
docker network ls
docker network inspect creatorcircle-network
```

### High Memory Usage

```bash
# 컨테이너 상태 확인
docker stats

# 메모리 제한 조정
# docker-compose.prod.yml의 resources.limits.memory 수정
```

### SSL Certificate Renewal

```bash
# 인증서 갱신
sudo certbot renew

# Nginx 재시작
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Checklist

### Pre-Deployment

- [ ] 모든 환경 변수 설정됨
- [ ] 데이터베이스 마이그레이션 완료
- [ ] SSL 인증서 설치됨
- [ ] Stripe 웹훅 설정됨
- [ ] 백업 스크립트 설정됨

### Post-Deployment

- [ ] Health check 통과
- [ ] 로그인/회원가입 테스트
- [ ] 결제 테스트 (Stripe 테스트 모드)
- [ ] 이메일 발송 테스트
- [ ] 모니터링 대시보드 확인

### Security

- [ ] HTTPS 강제 적용
- [ ] 보안 헤더 설정됨
- [ ] 민감한 환경 변수 암호화
- [ ] 방화벽 규칙 설정
- [ ] SSH 키 인증만 허용
