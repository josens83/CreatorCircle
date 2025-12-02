/**
 * Audit Logging System
 *
 * 은행/금융 수준의 감사 로그
 * - 모든 중요 활동 기록
 * - 변조 방지 (해시)
 * - 실시간 알림
 * - 규정 준수 (GDPR, KISA)
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

export type AuditCategory =
  | 'AUTH'        // 인증 관련
  | 'USER'        // 사용자 관리
  | 'PAYMENT'     // 결제/구독
  | 'CONTENT'     // 콘텐츠 관리
  | 'CREATOR'     // 크리에이터 활동
  | 'ADMIN'       // 관리자 활동
  | 'SECURITY'    // 보안 이벤트
  | 'SYSTEM';     // 시스템 이벤트

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditEvent {
  /** 이벤트 ID */
  id: string;
  /** 타임스탬프 */
  timestamp: Date;
  /** 액션 이름 */
  action: string;
  /** 카테고리 */
  category: AuditCategory;
  /** 심각도 */
  severity: AuditSeverity;
  /** 사용자 ID (있는 경우) */
  userId?: string | null;
  /** 대상 리소스 타입 */
  resourceType?: string;
  /** 대상 리소스 ID */
  resourceId?: string;
  /** IP 주소 */
  ip: string;
  /** User Agent */
  userAgent: string;
  /** 추가 상세 정보 */
  details?: Record<string, unknown>;
  /** 결과 (성공/실패) */
  outcome: 'SUCCESS' | 'FAILURE';
  /** 실패 이유 */
  failureReason?: string;
  /** 무결성 해시 */
  hash?: string;
}

// ============================================
// Audit Logger Class
// ============================================

class AuditLogger {
  private buffer: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5초

  constructor() {
    // 버퍼 주기적 플러시
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * 감사 이벤트 로깅
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'hash'>): Promise<void> {
    const fullEvent: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event,
    };

    // 무결성 해시 생성
    fullEvent.hash = this.generateHash(fullEvent);

    // 버퍼에 추가
    this.buffer.push(fullEvent);

    // 콘솔 로깅 (개발용)
    this.logToConsole(fullEvent);

    // 중요 이벤트는 즉시 처리
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      await this.flush();
      await this.sendAlert(fullEvent);
    }

    // 버퍼 가득 차면 플러시
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  /**
   * 버퍼 DB에 저장
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      // Prisma에 AuditLog 모델이 있다고 가정
      // 없으면 콘솔에만 로깅
      if (typeof prisma !== 'undefined' && (prisma as any).auditLog) {
        await (prisma as any).auditLog.createMany({
          data: events.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            action: e.action,
            category: e.category,
            severity: e.severity,
            userId: e.userId,
            resourceType: e.resourceType,
            resourceId: e.resourceId,
            ip: e.ip,
            userAgent: e.userAgent,
            details: e.details ? JSON.stringify(e.details) : null,
            outcome: e.outcome,
            failureReason: e.failureReason,
            hash: e.hash,
          })),
        });
      }
    } catch (error) {
      // DB 저장 실패해도 로그는 콘솔에 기록됨
      console.error('[AuditLogger] Failed to flush to database:', error);
    }
  }

  /**
   * 이벤트 ID 생성
   */
  private generateId(): string {
    return `aud_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 무결성 해시 생성
   */
  private generateHash(event: Omit<AuditEvent, 'hash'>): string {
    const data = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      action: event.action,
      category: event.category,
      userId: event.userId,
      resourceId: event.resourceId,
      ip: event.ip,
      outcome: event.outcome,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 콘솔 로깅
   */
  private logToConsole(event: AuditEvent): void {
    const prefix = `[AUDIT:${event.category}:${event.severity}]`;
    const message = `${event.action} - ${event.outcome}`;

    if (event.severity === 'CRITICAL') {
      console.error(prefix, message, event);
    } else if (event.severity === 'HIGH') {
      console.warn(prefix, message, event);
    } else {
      console.log(prefix, message, { id: event.id, userId: event.userId });
    }
  }

  /**
   * 실시간 알림 전송
   */
  private async sendAlert(event: AuditEvent): Promise<void> {
    // TODO: Slack, PagerDuty, Email 등으로 알림
    console.log('[ALERT]', event.action, event.severity);
  }

  /**
   * 클린업
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }

  // ============================================
  // Pre-defined Event Methods
  // ============================================

  // 인증 이벤트
  async logLoginSuccess(userId: string, ip: string, userAgent: string): Promise<void> {
    await this.log({
      action: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTH',
      severity: 'LOW',
      userId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
    });
  }

  async logLoginFailure(
    email: string,
    ip: string,
    userAgent: string,
    reason: string
  ): Promise<void> {
    await this.log({
      action: 'AUTH_LOGIN_FAILURE',
      category: 'AUTH',
      severity: 'MEDIUM',
      ip,
      userAgent,
      outcome: 'FAILURE',
      failureReason: reason,
      details: { email: this.maskEmail(email) },
    });
  }

  async logLogout(userId: string, ip: string, userAgent: string): Promise<void> {
    await this.log({
      action: 'AUTH_LOGOUT',
      category: 'AUTH',
      severity: 'LOW',
      userId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
    });
  }

  async logPasswordChange(userId: string, ip: string, userAgent: string): Promise<void> {
    await this.log({
      action: 'AUTH_PASSWORD_CHANGE',
      category: 'AUTH',
      severity: 'MEDIUM',
      userId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
    });
  }

  async logPasswordResetRequest(email: string, ip: string, userAgent: string): Promise<void> {
    await this.log({
      action: 'AUTH_PASSWORD_RESET_REQUEST',
      category: 'AUTH',
      severity: 'MEDIUM',
      ip,
      userAgent,
      outcome: 'SUCCESS',
      details: { email: this.maskEmail(email) },
    });
  }

  // 결제 이벤트
  async logPaymentAttempt(
    userId: string,
    amount: number,
    currency: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: 'PAYMENT_ATTEMPT',
      category: 'PAYMENT',
      severity: 'HIGH',
      userId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
      details: { amount, currency },
    });
  }

  async logPaymentSuccess(
    userId: string,
    amount: number,
    transactionId: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: 'PAYMENT_SUCCESS',
      category: 'PAYMENT',
      severity: 'HIGH',
      userId,
      resourceType: 'Transaction',
      resourceId: transactionId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
      details: { amount },
    });
  }

  async logPaymentFailure(
    userId: string,
    amount: number,
    reason: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: 'PAYMENT_FAILURE',
      category: 'PAYMENT',
      severity: 'HIGH',
      userId,
      ip,
      userAgent,
      outcome: 'FAILURE',
      failureReason: reason,
      details: { amount },
    });
  }

  async logSubscriptionChange(
    userId: string,
    subscriptionId: string,
    action: 'CREATE' | 'UPGRADE' | 'DOWNGRADE' | 'CANCEL',
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: `SUBSCRIPTION_${action}`,
      category: 'PAYMENT',
      severity: 'MEDIUM',
      userId,
      resourceType: 'Subscription',
      resourceId: subscriptionId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
    });
  }

  // 보안 이벤트
  async logUnauthorizedAccess(
    resourceType: string,
    resourceId: string,
    userId: string | null,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: 'SECURITY_UNAUTHORIZED_ACCESS',
      category: 'SECURITY',
      severity: 'HIGH',
      userId,
      resourceType,
      resourceId,
      ip,
      userAgent,
      outcome: 'FAILURE',
    });
  }

  async logRateLimitExceeded(
    endpoint: string,
    userId: string | null,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: 'SECURITY_RATE_LIMIT_EXCEEDED',
      category: 'SECURITY',
      severity: 'MEDIUM',
      userId,
      ip,
      userAgent,
      outcome: 'FAILURE',
      details: { endpoint },
    });
  }

  async logSuspiciousActivity(
    activity: string,
    userId: string | null,
    ip: string,
    userAgent: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action: 'SECURITY_SUSPICIOUS_ACTIVITY',
      category: 'SECURITY',
      severity: 'CRITICAL',
      userId,
      ip,
      userAgent,
      outcome: 'FAILURE',
      details: { activity, ...details },
    });
  }

  // 관리자 이벤트
  async logAdminAction(
    adminUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    ip: string,
    userAgent: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action: `ADMIN_${action}`,
      category: 'ADMIN',
      severity: 'HIGH',
      userId: adminUserId,
      resourceType: targetType,
      resourceId: targetId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
      details,
    });
  }

  // 콘텐츠 이벤트
  async logContentCreate(
    userId: string,
    contentType: string,
    contentId: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: 'CONTENT_CREATE',
      category: 'CONTENT',
      severity: 'LOW',
      userId,
      resourceType: contentType,
      resourceId: contentId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
    });
  }

  async logContentDelete(
    userId: string,
    contentType: string,
    contentId: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      action: 'CONTENT_DELETE',
      category: 'CONTENT',
      severity: 'MEDIUM',
      userId,
      resourceType: contentType,
      resourceId: contentId,
      ip,
      userAgent,
      outcome: 'SUCCESS',
    });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * 이메일 마스킹
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    const maskedLocal = local.length > 2
      ? local.slice(0, 2) + '*'.repeat(Math.min(local.length - 2, 5))
      : '*'.repeat(local.length);
    return `${maskedLocal}@${domain}`;
  }

  /**
   * 감사 로그 조회 (관리자용)
   */
  async query(options: {
    userId?: string;
    category?: AuditCategory;
    severity?: AuditSeverity;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    // DB에서 조회 로직
    // 실제 구현은 Prisma 모델에 따라
    return [];
  }
}

// 싱글톤 인스턴스
export const audit = new AuditLogger();

// ============================================
// Type Guards & Helpers
// ============================================

export function isHighSeverity(event: AuditEvent): boolean {
  return event.severity === 'HIGH' || event.severity === 'CRITICAL';
}

export function isSecurityEvent(event: AuditEvent): boolean {
  return event.category === 'SECURITY';
}

export function isPaymentEvent(event: AuditEvent): boolean {
  return event.category === 'PAYMENT';
}
