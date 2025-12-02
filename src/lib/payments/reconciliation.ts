/**
 * Payment Reconciliation System
 *
 * 결제 재조정 및 정산 검증
 * - DB와 Stripe 간 불일치 탐지
 * - 일일/월간 정산 리포트
 * - 이상 거래 감지
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PaymentCalculator } from './calculations';

// ============================================
// Types
// ============================================

export interface ReconciliationResult {
  date: Date;
  period: 'daily' | 'weekly' | 'monthly';
  summary: {
    totalTransactions: number;
    matchedCount: number;
    discrepancyCount: number;
    totalAmount: number;
    totalFees: number;
  };
  discrepancies: Discrepancy[];
  recommendations: string[];
}

export interface Discrepancy {
  type: DiscrepancyType;
  transactionId?: string;
  stripeId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  dbAmount?: number;
  stripeAmount?: number;
  action: string;
}

type DiscrepancyType =
  | 'MISSING_IN_DB'       // Stripe에는 있지만 DB에 없음
  | 'MISSING_IN_STRIPE'   // DB에는 있지만 Stripe에 없음
  | 'AMOUNT_MISMATCH'     // 금액 불일치
  | 'STATUS_MISMATCH'     // 상태 불일치
  | 'DUPLICATE_ENTRY'     // 중복 엔트리
  | 'ORPHAN_RECORD';      // 연결이 끊긴 레코드

// ============================================
// Reconciliation Service
// ============================================

export class ReconciliationService {
  private stripe: Stripe;

  constructor(stripeSecretKey: string) {
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * 일일 재조정 실행
   */
  async runDailyReconciliation(date: Date = new Date()): Promise<ReconciliationResult> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.reconcile(startOfDay, endOfDay, 'daily');
  }

  /**
   * 월간 재조정 실행
   */
  async runMonthlyReconciliation(year: number, month: number): Promise<ReconciliationResult> {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    return this.reconcile(startOfMonth, endOfMonth, 'monthly');
  }

  /**
   * 재조정 메인 로직
   */
  private async reconcile(
    startDate: Date,
    endDate: Date,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<ReconciliationResult> {
    const discrepancies: Discrepancy[] = [];

    // 1. DB에서 거래 조회
    const dbTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ['COMPLETED', 'REFUNDED', 'PARTIAL_REFUND'] },
      },
    });

    // 2. Stripe에서 결제 조회
    const stripeCharges = await this.fetchStripeCharges(startDate, endDate);

    // 3. 매칭 및 불일치 탐지
    const matchedStripeIds = new Set<string>();

    for (const dbTx of dbTransactions) {
      const stripeCharge = stripeCharges.find(
        c => c.payment_intent === dbTx.stripePaymentIntentId
      );

      if (!stripeCharge) {
        // DB에는 있지만 Stripe에 없음
        discrepancies.push({
          type: 'MISSING_IN_STRIPE',
          transactionId: dbTx.id,
          stripeId: dbTx.stripePaymentIntentId || 'unknown',
          severity: 'HIGH',
          description: 'Transaction exists in DB but not found in Stripe',
          dbAmount: dbTx.amount,
          action: 'Verify transaction status manually',
        });
        continue;
      }

      matchedStripeIds.add(stripeCharge.id);

      // 금액 확인
      if (stripeCharge.amount !== dbTx.amount) {
        discrepancies.push({
          type: 'AMOUNT_MISMATCH',
          transactionId: dbTx.id,
          stripeId: stripeCharge.id,
          severity: 'CRITICAL',
          description: 'Amount mismatch between DB and Stripe',
          dbAmount: dbTx.amount,
          stripeAmount: stripeCharge.amount,
          action: 'Investigate immediately - potential financial discrepancy',
        });
      }

      // 상태 확인
      const expectedStatus = this.mapStripeStatus(stripeCharge.status);
      if (dbTx.status !== expectedStatus && dbTx.status !== 'REFUNDED') {
        discrepancies.push({
          type: 'STATUS_MISMATCH',
          transactionId: dbTx.id,
          stripeId: stripeCharge.id,
          severity: 'MEDIUM',
          description: `Status mismatch: DB=${dbTx.status}, Stripe=${stripeCharge.status}`,
          action: 'Sync status from Stripe',
        });
      }
    }

    // 4. Stripe에만 있는 거래 탐지
    for (const stripeCharge of stripeCharges) {
      if (!matchedStripeIds.has(stripeCharge.id)) {
        discrepancies.push({
          type: 'MISSING_IN_DB',
          stripeId: stripeCharge.id,
          severity: 'HIGH',
          description: 'Charge exists in Stripe but not in DB',
          stripeAmount: stripeCharge.amount,
          action: 'Create transaction record or investigate webhook failure',
        });
      }
    }

    // 5. 권장 사항 생성
    const recommendations = this.generateRecommendations(discrepancies);

    // 6. 결과 요약
    const totalAmount = dbTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalFees = dbTransactions.reduce(
      (sum, tx) => sum + (tx.platformFee || 0) + (tx.stripeFee || 0),
      0
    );

    return {
      date: new Date(),
      period,
      summary: {
        totalTransactions: stripeCharges.length,
        matchedCount: matchedStripeIds.size,
        discrepancyCount: discrepancies.length,
        totalAmount,
        totalFees,
      },
      discrepancies,
      recommendations,
    };
  }

  /**
   * Stripe 결제 조회
   */
  private async fetchStripeCharges(
    startDate: Date,
    endDate: Date
  ): Promise<Stripe.Charge[]> {
    const charges: Stripe.Charge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await this.stripe.charges.list({
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000),
        },
        limit: 100,
        starting_after: startingAfter,
      });

      charges.push(...response.data);
      hasMore = response.has_more;

      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }
    }

    return charges;
  }

  /**
   * Stripe 상태 매핑
   */
  private mapStripeStatus(status: string): string {
    const mapping: Record<string, string> = {
      succeeded: 'COMPLETED',
      pending: 'PENDING',
      failed: 'FAILED',
    };
    return mapping[status] || 'UNKNOWN';
  }

  /**
   * 권장 사항 생성
   */
  private generateRecommendations(discrepancies: Discrepancy[]): string[] {
    const recommendations: string[] = [];

    const criticalCount = discrepancies.filter(d => d.severity === 'CRITICAL').length;
    const highCount = discrepancies.filter(d => d.severity === 'HIGH').length;

    if (criticalCount > 0) {
      recommendations.push(
        `⚠️ CRITICAL: ${criticalCount}개의 심각한 불일치 발견. 즉시 조사 필요.`
      );
    }

    if (highCount > 0) {
      recommendations.push(
        `🔴 HIGH: ${highCount}개의 중요 불일치 발견. 24시간 내 조사 권장.`
      );
    }

    const missingInDb = discrepancies.filter(d => d.type === 'MISSING_IN_DB').length;
    if (missingInDb > 0) {
      recommendations.push(
        `Webhook 처리 실패 가능성: ${missingInDb}개 거래가 DB에 없음. 웹훅 로그 확인 필요.`
      );
    }

    const amountMismatches = discrepancies.filter(d => d.type === 'AMOUNT_MISMATCH').length;
    if (amountMismatches > 0) {
      recommendations.push(
        `금액 불일치: ${amountMismatches}개. 수동 조정 또는 환불 처리 검토 필요.`
      );
    }

    if (discrepancies.length === 0) {
      recommendations.push('✅ 모든 거래가 정상적으로 매칭됨.');
    }

    return recommendations;
  }

  /**
   * 불일치 자동 수정 (주의해서 사용)
   */
  async autoFixDiscrepancy(discrepancy: Discrepancy): Promise<boolean> {
    // STATUS_MISMATCH만 자동 수정 허용
    if (discrepancy.type !== 'STATUS_MISMATCH' || !discrepancy.transactionId) {
      return false;
    }

    try {
      // Stripe에서 최신 상태 조회
      const charge = await this.stripe.charges.retrieve(discrepancy.stripeId);
      const newStatus = this.mapStripeStatus(charge.status);

      // DB 업데이트
      await prisma.transaction.update({
        where: { id: discrepancy.transactionId },
        data: { status: newStatus },
      });

      console.log(`[Reconciliation] Fixed status for ${discrepancy.transactionId}`);
      return true;
    } catch (error) {
      console.error(`[Reconciliation] Failed to fix ${discrepancy.transactionId}:`, error);
      return false;
    }
  }
}

// ============================================
// Payout Calculator
// ============================================

export class PayoutCalculator {
  /**
   * 크리에이터별 정산 예정 금액 계산
   */
  static async calculateCreatorPayout(
    creatorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    totalFees: number;
    netPayout: number;
    transactions: number;
    breakdown: {
      subscriptions: number;
      products: number;
      tips: number;
    };
  }> {
    const transactions = await prisma.transaction.findMany({
      where: {
        circle: { creatorId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'COMPLETED',
      },
    });

    let totalRevenue = 0;
    let totalFees = 0;
    const breakdown = { subscriptions: 0, products: 0, tips: 0 };

    for (const tx of transactions) {
      totalRevenue += tx.amount;
      totalFees += (tx.platformFee || 0) + (tx.stripeFee || 0);

      switch (tx.type) {
        case 'SUBSCRIPTION':
        case 'RENEWAL':
          breakdown.subscriptions += tx.creatorEarnings || 0;
          break;
        case 'PRODUCT':
          breakdown.products += tx.creatorEarnings || 0;
          break;
        case 'TIP':
          breakdown.tips += tx.creatorEarnings || 0;
          break;
      }
    }

    return {
      totalRevenue,
      totalFees,
      netPayout: totalRevenue - totalFees,
      transactions: transactions.length,
      breakdown,
    };
  }

  /**
   * 정산 일정 계산 (매주 월요일)
   */
  static getNextPayoutDate(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0); // 오전 9시

    return nextMonday;
  }

  /**
   * 정산 기간 계산
   */
  static getPayoutPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // 지난 월요일
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek - 6);
    start.setHours(0, 0, 0, 0);

    // 지난 일요일
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }
}

// ============================================
// Singleton
// ============================================

let reconciliationService: ReconciliationService | null = null;

export function getReconciliationService(): ReconciliationService {
  if (!reconciliationService) {
    reconciliationService = new ReconciliationService(
      process.env.STRIPE_SECRET_KEY || ''
    );
  }
  return reconciliationService;
}
