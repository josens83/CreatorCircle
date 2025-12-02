/**
 * Payment Calculations with Decimal Precision
 *
 * Stripe 수준의 금액 계산
 * - Decimal.js로 부동소수점 오류 방지
 * - 플랫폼 수수료 정확 계산
 * - Stripe 수수료 포함 계산
 * - 레퍼럴 커미션 계산
 */

// ============================================
// Decimal.js 대체 구현 (의존성 최소화)
// 프로덕션에서는 decimal.js 패키지 사용 권장
// ============================================

class Decimal {
  private value: bigint;
  private scale: number;
  private static readonly DEFAULT_SCALE = 4; // 소수점 4자리까지

  constructor(value: number | string | Decimal) {
    if (value instanceof Decimal) {
      this.value = value.value;
      this.scale = value.scale;
    } else {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      this.scale = Decimal.DEFAULT_SCALE;
      this.value = BigInt(Math.round(numValue * Math.pow(10, this.scale)));
    }
  }

  plus(other: number | string | Decimal): Decimal {
    const otherDecimal = new Decimal(other);
    const result = new Decimal(0);
    result.value = this.value + otherDecimal.value;
    result.scale = this.scale;
    return result;
  }

  minus(other: number | string | Decimal): Decimal {
    const otherDecimal = new Decimal(other);
    const result = new Decimal(0);
    result.value = this.value - otherDecimal.value;
    result.scale = this.scale;
    return result;
  }

  mul(other: number | string | Decimal): Decimal {
    const otherDecimal = new Decimal(other);
    const result = new Decimal(0);
    result.value = (this.value * otherDecimal.value) / BigInt(Math.pow(10, this.scale));
    result.scale = this.scale;
    return result;
  }

  div(other: number | string | Decimal): Decimal {
    const otherDecimal = new Decimal(other);
    if (otherDecimal.value === BigInt(0)) {
      throw new Error('Division by zero');
    }
    const result = new Decimal(0);
    result.value = (this.value * BigInt(Math.pow(10, this.scale))) / otherDecimal.value;
    result.scale = this.scale;
    return result;
  }

  toNumber(): number {
    return Number(this.value) / Math.pow(10, this.scale);
  }

  toFixed(decimals: number = 0): string {
    const numValue = this.toNumber();
    return numValue.toFixed(decimals);
  }

  toString(): string {
    return this.toNumber().toString();
  }

  // 반올림
  round(): Decimal {
    const result = new Decimal(Math.round(this.toNumber()));
    return result;
  }

  // 내림
  floor(): Decimal {
    const result = new Decimal(Math.floor(this.toNumber()));
    return result;
  }

  // 올림
  ceil(): Decimal {
    const result = new Decimal(Math.ceil(this.toNumber()));
    return result;
  }

  // 비교
  greaterThan(other: number | string | Decimal): boolean {
    const otherDecimal = new Decimal(other);
    return this.value > otherDecimal.value;
  }

  lessThan(other: number | string | Decimal): boolean {
    const otherDecimal = new Decimal(other);
    return this.value < otherDecimal.value;
  }

  equals(other: number | string | Decimal): boolean {
    const otherDecimal = new Decimal(other);
    return this.value === otherDecimal.value;
  }
}

// ============================================
// Fee Configuration
// ============================================

/** 플랫폼 수수료율 (10%) */
export const PLATFORM_FEE_RATE = 0.10;

/** Stripe 수수료율 (한국: 3.4% + 400원) */
export const STRIPE_FEE_RATE = 0.034;
export const STRIPE_FEE_FIXED = 400; // 원

/** 레퍼럴 커미션율 범위 */
export const REFERRAL_COMMISSION_RATES = {
  DEFAULT: 0.20,    // 20%
  PREMIUM: 0.30,    // 30%
  VIP: 0.40,        // 40%
  PARTNER: 0.50,    // 50%
  MAX: 0.60,        // 60% (최대)
};

// ============================================
// Types
// ============================================

export interface PaymentBreakdown {
  /** 총 결제 금액 (사용자가 결제하는 금액) */
  grossAmount: number;
  /** Stripe 수수료 */
  stripeFee: number;
  /** 플랫폼 수수료 */
  platformFee: number;
  /** 크리에이터 수익 */
  creatorEarnings: number;
  /** 레퍼럴 커미션 (있는 경우) */
  referralCommission?: number;
  /** 레퍼럴 제외 후 크리에이터 수익 */
  netCreatorEarnings?: number;
}

export interface SubscriptionPricing {
  /** 원가 */
  originalPrice: number;
  /** 할인율 (%) */
  discountRate?: number;
  /** 할인 금액 */
  discountAmount: number;
  /** 최종 가격 */
  finalPrice: number;
  /** 월 환산 가격 (연간 구독 시) */
  monthlyEquivalent?: number;
}

// ============================================
// Payment Calculator
// ============================================

export class PaymentCalculator {
  /**
   * 결제 금액 분배 계산
   *
   * @param grossAmount 총 결제 금액 (원)
   * @param referralRate 레퍼럴 커미션율 (0-0.6)
   * @returns PaymentBreakdown
   */
  static calculateBreakdown(
    grossAmount: number,
    referralRate?: number
  ): PaymentBreakdown {
    const gross = new Decimal(grossAmount);

    // 1. Stripe 수수료 계산
    // 수수료 = 금액 × 3.4% + 400원
    const stripeFee = gross
      .mul(STRIPE_FEE_RATE)
      .plus(STRIPE_FEE_FIXED)
      .round();

    // 2. Stripe 수수료 제외 금액
    const afterStripe = gross.minus(stripeFee);

    // 3. 플랫폼 수수료 계산 (10%)
    const platformFee = afterStripe.mul(PLATFORM_FEE_RATE).round();

    // 4. 크리에이터 수익
    const creatorEarnings = afterStripe.minus(platformFee);

    // 5. 레퍼럴 커미션 (선택적)
    let referralCommission: number | undefined;
    let netCreatorEarnings: number | undefined;

    if (referralRate && referralRate > 0) {
      // 레퍼럴 커미션은 크리에이터 수익에서 차감
      const commission = creatorEarnings.mul(Math.min(referralRate, REFERRAL_COMMISSION_RATES.MAX));
      referralCommission = Math.round(commission.toNumber());
      netCreatorEarnings = Math.round(creatorEarnings.toNumber() - referralCommission);
    }

    return {
      grossAmount: Math.round(gross.toNumber()),
      stripeFee: Math.round(stripeFee.toNumber()),
      platformFee: Math.round(platformFee.toNumber()),
      creatorEarnings: Math.round(creatorEarnings.toNumber()),
      ...(referralCommission !== undefined && { referralCommission }),
      ...(netCreatorEarnings !== undefined && { netCreatorEarnings }),
    };
  }

  /**
   * 구독 가격 계산 (할인 적용)
   */
  static calculateSubscriptionPrice(
    monthlyPrice: number,
    billingCycle: 'monthly' | 'yearly' | 'lifetime',
    yearlyDiscountRate: number = 20 // 기본 20% 할인
  ): SubscriptionPricing {
    const monthly = new Decimal(monthlyPrice);

    switch (billingCycle) {
      case 'monthly':
        return {
          originalPrice: monthlyPrice,
          discountAmount: 0,
          finalPrice: monthlyPrice,
        };

      case 'yearly': {
        const yearlyOriginal = monthly.mul(12);
        const discountAmount = yearlyOriginal.mul(yearlyDiscountRate / 100);
        const finalPrice = yearlyOriginal.minus(discountAmount);

        return {
          originalPrice: Math.round(yearlyOriginal.toNumber()),
          discountRate: yearlyDiscountRate,
          discountAmount: Math.round(discountAmount.toNumber()),
          finalPrice: Math.round(finalPrice.toNumber()),
          monthlyEquivalent: Math.round(finalPrice.div(12).toNumber()),
        };
      }

      case 'lifetime': {
        // 평생 구독: 연간 가격 × 3 (3년치)
        const lifetimeMultiplier = 3;
        const yearlyPrice = monthly.mul(12);
        const lifetimePrice = yearlyPrice.mul(lifetimeMultiplier);
        // 추가 10% 할인
        const discountAmount = lifetimePrice.mul(0.1);
        const finalPrice = lifetimePrice.minus(discountAmount);

        return {
          originalPrice: Math.round(lifetimePrice.toNumber()),
          discountRate: 10,
          discountAmount: Math.round(discountAmount.toNumber()),
          finalPrice: Math.round(finalPrice.toNumber()),
        };
      }

      default:
        return {
          originalPrice: monthlyPrice,
          discountAmount: 0,
          finalPrice: monthlyPrice,
        };
    }
  }

  /**
   * 환불 금액 계산
   */
  static calculateRefundAmount(
    originalAmount: number,
    daysUsed: number,
    totalDays: number,
    refundPolicy: 'full' | 'prorated' | 'none' = 'prorated'
  ): { refundAmount: number; reason: string } {
    switch (refundPolicy) {
      case 'full':
        return {
          refundAmount: originalAmount,
          reason: 'Full refund policy',
        };

      case 'none':
        return {
          refundAmount: 0,
          reason: 'No refund policy',
        };

      case 'prorated':
      default: {
        if (daysUsed >= totalDays) {
          return {
            refundAmount: 0,
            reason: 'Subscription period fully used',
          };
        }

        const original = new Decimal(originalAmount);
        const usedRatio = new Decimal(daysUsed).div(totalDays);
        const usedAmount = original.mul(usedRatio);
        const refundAmount = original.minus(usedAmount);

        return {
          refundAmount: Math.max(0, Math.round(refundAmount.toNumber())),
          reason: `Prorated refund: ${daysUsed}/${totalDays} days used`,
        };
      }
    }
  }

  /**
   * 정산 예정 금액 계산
   */
  static calculatePayoutAmount(
    transactions: Array<{ amount: number; type: 'subscription' | 'product' | 'tip' }>
  ): {
    totalGross: number;
    totalFees: number;
    totalPayout: number;
    breakdown: { type: string; amount: number }[];
  } {
    let totalGross = 0;
    let totalFees = 0;
    const breakdown: { type: string; amount: number }[] = [];

    const typeGroups: Record<string, number> = {};

    for (const tx of transactions) {
      totalGross += tx.amount;
      const { platformFee, stripeFee, creatorEarnings } = this.calculateBreakdown(tx.amount);
      totalFees += platformFee + stripeFee;

      typeGroups[tx.type] = (typeGroups[tx.type] || 0) + creatorEarnings;
    }

    for (const [type, amount] of Object.entries(typeGroups)) {
      breakdown.push({ type, amount });
    }

    return {
      totalGross,
      totalFees,
      totalPayout: totalGross - totalFees,
      breakdown,
    };
  }

  /**
   * 가격 포맷팅
   */
  static formatPrice(amount: number, currency: string = 'KRW'): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * 금액 검증
   */
  static validateAmount(amount: number): { valid: boolean; error?: string } {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return { valid: false, error: 'Invalid amount type' };
    }

    if (amount < 0) {
      return { valid: false, error: 'Amount cannot be negative' };
    }

    if (amount > 100000000) { // 1억원 상한
      return { valid: false, error: 'Amount exceeds maximum limit' };
    }

    if (!Number.isInteger(amount)) {
      return { valid: false, error: 'Amount must be an integer (won)' };
    }

    return { valid: true };
  }
}

// ============================================
// Export Decimal for external use
// ============================================

export { Decimal };
