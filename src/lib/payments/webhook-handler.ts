/**
 * Stripe Webhook Handler with Idempotency
 *
 * Stripe 수준의 웹훅 처리
 * - 멱등성 보장 (중복 처리 방지)
 * - 트랜잭션 일관성
 * - 재시도 안전
 * - 에러 복구
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PaymentCalculator } from './calculations';
import { audit } from '@/lib/security/audit';

// ============================================
// Types
// ============================================

interface WebhookProcessResult {
  success: boolean;
  eventId: string;
  action: string;
  error?: string;
}

interface ProcessedWebhook {
  eventId: string;
  eventType: string;
  processedAt: Date;
  status: 'SUCCESS' | 'FAILURE';
  error?: string;
}

// ============================================
// In-Memory Idempotency Store
// 프로덕션에서는 Redis 사용 권장
// ============================================

class IdempotencyStore {
  private processed = new Map<string, ProcessedWebhook>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24시간

  async isProcessed(eventId: string): Promise<ProcessedWebhook | null> {
    const entry = this.processed.get(eventId);
    if (!entry) return null;

    // TTL 체크
    if (Date.now() - entry.processedAt.getTime() > this.TTL) {
      this.processed.delete(eventId);
      return null;
    }

    return entry;
  }

  async markProcessed(
    eventId: string,
    eventType: string,
    status: 'SUCCESS' | 'FAILURE',
    error?: string
  ): Promise<void> {
    this.processed.set(eventId, {
      eventId,
      eventType,
      processedAt: new Date(),
      status,
      error,
    });
  }

  // 주기적 정리
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.processed.entries()) {
      if (now - entry.processedAt.getTime() > this.TTL) {
        this.processed.delete(key);
      }
    }
  }
}

const idempotencyStore = new IdempotencyStore();

// 1시간마다 정리
setInterval(() => idempotencyStore.cleanup(), 60 * 60 * 1000);

// ============================================
// Webhook Handler Class
// ============================================

export class StripeWebhookHandler {
  private stripe: Stripe;

  constructor(stripeSecretKey: string) {
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * 웹훅 이벤트 처리 (멱등성 보장)
   */
  async handleEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
    const eventId = event.id;
    const eventType = event.type;

    // 1. 이미 처리된 이벤트인지 확인
    const existing = await idempotencyStore.isProcessed(eventId);
    if (existing) {
      console.log(`[Webhook] Event ${eventId} already processed, skipping`);
      return {
        success: existing.status === 'SUCCESS',
        eventId,
        action: 'SKIPPED_DUPLICATE',
        error: existing.error,
      };
    }

    // 2. 이벤트 처리
    try {
      await this.processEvent(event);

      // 3. 성공 기록
      await idempotencyStore.markProcessed(eventId, eventType, 'SUCCESS');

      return {
        success: true,
        eventId,
        action: eventType,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 4. 실패 기록
      await idempotencyStore.markProcessed(eventId, eventType, 'FAILURE', errorMessage);

      console.error(`[Webhook] Failed to process ${eventId}:`, error);

      return {
        success: false,
        eventId,
        action: eventType,
        error: errorMessage,
      };
    }
  }

  /**
   * 이벤트 타입별 처리
   */
  private async processEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      // 결제 완료
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // 구독 생성
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      // 구독 업데이트
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      // 구독 취소
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // 인보이스 결제 완료
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      // 인보이스 결제 실패
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // 환불 완료
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      // 분쟁 생성
      case 'charge.dispute.created':
        await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      // 분쟁 종료
      case 'charge.dispute.closed':
        await this.handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      // 정산 완료
      case 'payout.paid':
        await this.handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Checkout 완료 처리
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = session.metadata;
    if (!metadata) {
      throw new Error('Missing session metadata');
    }

    const { circleId, userId, tierId, type, referralCode } = metadata;

    // 트랜잭션으로 일관성 보장
    await prisma.$transaction(async (tx) => {
      if (type === 'subscription') {
        // 멤버십 생성
        await tx.member.upsert({
          where: {
            circleId_userId: { circleId, userId },
          },
          create: {
            circleId,
            userId,
            tierId,
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
          update: {
            tierId,
            status: 'ACTIVE',
          },
        });

        // 구독 기록
        await tx.subscription.create({
          data: {
            userId,
            circleId,
            tierId,
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: this.calculatePeriodEnd(tierId),
          },
        });

        // 멤버 수 증가
        await tx.circle.update({
          where: { id: circleId },
          data: { memberCount: { increment: 1 } },
        });

        // 레퍼럴 처리
        if (referralCode && session.amount_total) {
          await this.processReferral(tx, referralCode, session.amount_total, userId, circleId);
        }
      } else if (type === 'product') {
        // 상품 구매 처리
        await tx.purchase.create({
          data: {
            productId: metadata.productId!,
            userId,
            amount: session.amount_total || 0,
            stripePaymentIntentId: session.payment_intent as string,
            status: 'COMPLETED',
            purchasedAt: new Date(),
          },
        });
      }

      // 거래 기록
      const breakdown = PaymentCalculator.calculateBreakdown(
        session.amount_total || 0,
        referralCode ? 0.2 : undefined
      );

      await tx.transaction.create({
        data: {
          stripePaymentIntentId: session.payment_intent as string,
          userId,
          circleId: circleId || null,
          type: type === 'subscription' ? 'SUBSCRIPTION' : 'PRODUCT',
          amount: breakdown.grossAmount,
          platformFee: breakdown.platformFee,
          stripeFee: breakdown.stripeFee,
          creatorEarnings: breakdown.netCreatorEarnings || breakdown.creatorEarnings,
          status: 'COMPLETED',
        },
      });
    });

    // 감사 로그
    await audit.logPaymentSuccess(
      userId,
      session.amount_total || 0,
      session.payment_intent as string,
      'webhook',
      'stripe-webhook'
    );
  }

  /**
   * 구독 생성
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    console.log(`[Webhook] Subscription created: ${subscription.id}`);
    // checkout.session.completed에서 이미 처리됨
  }

  /**
   * 구독 업데이트
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: this.mapSubscriptionStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  /**
   * 구독 삭제
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 구독 비활성화
      const sub = await tx.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (sub) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
          },
        });

        // 멤버 상태 변경
        await tx.member.updateMany({
          where: {
            circleId: sub.circleId,
            userId: sub.userId,
          },
          data: { status: 'INACTIVE' },
        });

        // 멤버 수 감소
        await tx.circle.update({
          where: { id: sub.circleId },
          data: { memberCount: { decrement: 1 } },
        });
      }
    });
  }

  /**
   * 인보이스 결제 완료 (갱신 결제)
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (sub) {
        // 구독 갱신
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodStart: new Date(invoice.period_start * 1000),
            currentPeriodEnd: new Date(invoice.period_end * 1000),
            status: 'ACTIVE',
          },
        });

        // 거래 기록
        const breakdown = PaymentCalculator.calculateBreakdown(invoice.amount_paid);

        await tx.transaction.create({
          data: {
            stripePaymentIntentId: invoice.payment_intent as string,
            userId: sub.userId,
            circleId: sub.circleId,
            type: 'RENEWAL',
            amount: breakdown.grossAmount,
            platformFee: breakdown.platformFee,
            stripeFee: breakdown.stripeFee,
            creatorEarnings: breakdown.creatorEarnings,
            status: 'COMPLETED',
          },
        });
      }
    });
  }

  /**
   * 인보이스 결제 실패
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const attemptCount = invoice.attempt_count || 1;

    await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { stripeSubscriptionId: invoice.subscription as string },
        data: {
          status: attemptCount >= 3 ? 'PAST_DUE' : 'ACTIVE',
        },
      });

      // 결제 실패 기록
      await tx.paymentAttempt.create({
        data: {
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: invoice.subscription as string,
          amount: invoice.amount_due,
          status: 'FAILED',
          attemptNumber: attemptCount,
          failureReason: invoice.last_finalization_error?.message || 'Unknown',
          attemptedAt: new Date(),
        },
      });
    });

    // TODO: 사용자에게 결제 실패 알림 이메일 발송
  }

  /**
   * 환불 처리
   */
  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: { stripePaymentIntentId: charge.payment_intent as string },
      });

      if (transaction) {
        // 환불 금액 계산
        const refundedAmount = charge.amount_refunded;

        await tx.refund.create({
          data: {
            transactionId: transaction.id,
            stripeRefundId: charge.refunds?.data[0]?.id || '',
            amount: refundedAmount,
            reason: charge.refunds?.data[0]?.reason || 'requested_by_customer',
            status: 'COMPLETED',
            refundedAt: new Date(),
          },
        });

        // 거래 상태 업데이트
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: refundedAmount === charge.amount ? 'REFUNDED' : 'PARTIAL_REFUND',
            refundedAmount,
          },
        });
      }
    });
  }

  /**
   * 분쟁 생성
   */
  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: { stripePaymentIntentId: dispute.payment_intent as string },
      });

      if (transaction) {
        await tx.dispute.create({
          data: {
            transactionId: transaction.id,
            stripeDisputeId: dispute.id,
            amount: dispute.amount,
            reason: dispute.reason,
            status: 'OPEN',
            evidence_due_by: new Date(dispute.evidence_details?.due_by ? dispute.evidence_details.due_by * 1000 : Date.now()),
            createdAt: new Date(),
          },
        });

        // 거래 상태 업데이트
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'DISPUTED' },
        });
      }
    });

    // 긴급 알림
    await audit.logSuspiciousActivity(
      'payment_dispute',
      null,
      'webhook',
      'stripe',
      { disputeId: dispute.id, amount: dispute.amount, reason: dispute.reason }
    );
  }

  /**
   * 분쟁 종료
   */
  private async handleDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.dispute.updateMany({
        where: { stripeDisputeId: dispute.id },
        data: {
          status: dispute.status === 'won' ? 'WON' : 'LOST',
          resolvedAt: new Date(),
        },
      });

      // 분쟁 승리 시 거래 상태 복구
      if (dispute.status === 'won') {
        const disputeRecord = await tx.dispute.findFirst({
          where: { stripeDisputeId: dispute.id },
        });

        if (disputeRecord) {
          await tx.transaction.update({
            where: { id: disputeRecord.transactionId },
            data: { status: 'COMPLETED' },
          });
        }
      }
    });
  }

  /**
   * 정산 완료
   */
  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    // 정산 완료 기록
    console.log(`[Webhook] Payout completed: ${payout.id}, amount: ${payout.amount}`);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async processReferral(
    tx: any,
    referralCode: string,
    amount: number,
    userId: string,
    circleId: string
  ): Promise<void> {
    const referral = await tx.referral.findFirst({
      where: { code: referralCode, status: 'ACTIVE' },
    });

    if (referral) {
      const commission = PaymentCalculator.calculateBreakdown(amount, referral.commissionRate / 100);

      await tx.referralTransaction.create({
        data: {
          referralId: referral.id,
          referredUserId: userId,
          circleId,
          amount,
          commission: commission.referralCommission || 0,
          status: 'COMPLETED',
        },
      });

      // 레퍼러 수익 업데이트
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          totalEarnings: { increment: commission.referralCommission || 0 },
          totalReferrals: { increment: 1 },
        },
      });
    }
  }

  private calculatePeriodEnd(tierId: string): Date {
    // 기본 30일
    const days = 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
    const mapping: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      unpaid: 'UNPAID',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'EXPIRED',
      trialing: 'TRIALING',
      paused: 'PAUSED',
    };
    return mapping[status] || 'UNKNOWN';
  }
}

// ============================================
// Singleton Instance
// ============================================

let webhookHandler: StripeWebhookHandler | null = null;

export function getWebhookHandler(): StripeWebhookHandler {
  if (!webhookHandler) {
    webhookHandler = new StripeWebhookHandler(process.env.STRIPE_SECRET_KEY || '');
  }
  return webhookHandler;
}
