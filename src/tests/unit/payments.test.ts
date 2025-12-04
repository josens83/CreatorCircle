/**
 * Payment Calculations Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  Decimal,
  PaymentCalculator,
  PLATFORM_FEE_RATE,
  STRIPE_FEE_RATE,
  STRIPE_FEE_FIXED,
} from '@/lib/payments/calculations';

describe('Decimal', () => {
  describe('constructor', () => {
    it('should create from number', () => {
      const d = new Decimal(123.45);
      expect(d.toNumber()).toBe(123.45);
    });

    it('should create from string', () => {
      const d = new Decimal('123.45');
      expect(d.toNumber()).toBe(123.45);
    });

    it('should create from another Decimal', () => {
      const d1 = new Decimal(123.45);
      const d2 = new Decimal(d1);
      expect(d2.toNumber()).toBe(123.45);
    });

    it('should handle negative numbers', () => {
      const d = new Decimal(-100.5);
      expect(d.toNumber()).toBe(-100.5);
    });

    it('should handle zero', () => {
      const d = new Decimal(0);
      expect(d.toNumber()).toBe(0);
    });
  });

  describe('arithmetic operations', () => {
    it('should add correctly', () => {
      const a = new Decimal(10.1);
      const b = new Decimal(20.2);
      expect(a.plus(b).toNumber()).toBe(30.3);
    });

    it('should subtract correctly', () => {
      const a = new Decimal(100);
      const b = new Decimal(30.5);
      expect(a.minus(b).toNumber()).toBe(69.5);
    });

    it('should multiply correctly', () => {
      const a = new Decimal(10000);
      const b = new Decimal(0.1);
      expect(a.mul(b).toNumber()).toBe(1000);
    });

    it('should divide correctly', () => {
      const a = new Decimal(100);
      const b = new Decimal(3);
      // Division should be precise
      expect(a.div(b).toNumber()).toBeCloseTo(33.33, 2);
    });

    it('should avoid floating point errors', () => {
      // Famous floating point issue: 0.1 + 0.2 !== 0.3
      const a = new Decimal(0.1);
      const b = new Decimal(0.2);
      expect(a.plus(b).toNumber()).toBe(0.3);
    });
  });

  describe('rounding', () => {
    it('should round correctly', () => {
      expect(new Decimal(10.4).round().toNumber()).toBe(10);
      expect(new Decimal(10.5).round().toNumber()).toBe(11);
      expect(new Decimal(10.6).round().toNumber()).toBe(11);
    });

    it('should floor correctly', () => {
      expect(new Decimal(10.9).floor().toNumber()).toBe(10);
      expect(new Decimal(-10.1).floor().toNumber()).toBe(-11);
    });

    it('should ceil correctly', () => {
      expect(new Decimal(10.1).ceil().toNumber()).toBe(11);
      expect(new Decimal(-10.9).ceil().toNumber()).toBe(-10);
    });
  });

  describe('comparisons', () => {
    it('should compare equality', () => {
      expect(new Decimal(100).eq(new Decimal(100))).toBe(true);
      expect(new Decimal(100).eq(new Decimal(101))).toBe(false);
    });

    it('should compare greater than', () => {
      expect(new Decimal(101).gt(new Decimal(100))).toBe(true);
      expect(new Decimal(100).gt(new Decimal(100))).toBe(false);
    });

    it('should compare less than', () => {
      expect(new Decimal(99).lt(new Decimal(100))).toBe(true);
      expect(new Decimal(100).lt(new Decimal(100))).toBe(false);
    });

    it('should compare greater than or equal', () => {
      expect(new Decimal(100).gte(new Decimal(100))).toBe(true);
      expect(new Decimal(101).gte(new Decimal(100))).toBe(true);
      expect(new Decimal(99).gte(new Decimal(100))).toBe(false);
    });

    it('should compare less than or equal', () => {
      expect(new Decimal(100).lte(new Decimal(100))).toBe(true);
      expect(new Decimal(99).lte(new Decimal(100))).toBe(true);
      expect(new Decimal(101).lte(new Decimal(100))).toBe(false);
    });
  });
});

describe('PaymentCalculator', () => {
  describe('calculateBreakdown', () => {
    it('should calculate payment breakdown correctly', () => {
      const breakdown = PaymentCalculator.calculateBreakdown(10000);

      expect(breakdown.grossAmount).toBe(10000);

      // Stripe fee: 10000 * 0.034 + 400 = 740
      expect(breakdown.stripeFee).toBe(740);

      // After Stripe: 10000 - 740 = 9260
      // Platform fee: 9260 * 0.1 = 926
      expect(breakdown.platformFee).toBe(926);

      // Creator earnings: 9260 - 926 = 8334
      expect(breakdown.creatorEarnings).toBe(8334);

      // Total fees: 740 + 926 = 1666
      expect(breakdown.totalFees).toBe(1666);

      // Fee percentage: 1666 / 10000 = 16.66%
      expect(breakdown.feePercentage).toBeCloseTo(16.66, 1);
    });

    it('should calculate with referral', () => {
      const breakdown = PaymentCalculator.calculateBreakdown(10000, 0.05);

      expect(breakdown.referralFee).toBeDefined();
      // Referral gets 5% of platform fee
      expect(breakdown.referralFee).toBeGreaterThan(0);
    });

    it('should handle small amounts', () => {
      const breakdown = PaymentCalculator.calculateBreakdown(1000);

      expect(breakdown.grossAmount).toBe(1000);
      expect(breakdown.creatorEarnings).toBeGreaterThan(0);
      expect(breakdown.creatorEarnings).toBeLessThan(1000);
    });

    it('should handle large amounts', () => {
      const breakdown = PaymentCalculator.calculateBreakdown(1000000);

      expect(breakdown.grossAmount).toBe(1000000);
      expect(breakdown.creatorEarnings).toBeGreaterThan(800000);
    });
  });

  describe('calculateSubscriptionPrice', () => {
    it('should calculate monthly price', () => {
      const result = PaymentCalculator.calculateSubscriptionPrice(10000, 'monthly');

      expect(result.basePrice).toBe(10000);
      expect(result.finalPrice).toBe(10000);
      expect(result.discountAmount).toBe(0);
    });

    it('should apply yearly discount', () => {
      const result = PaymentCalculator.calculateSubscriptionPrice(10000, 'yearly');

      expect(result.basePrice).toBe(120000); // 12 months
      expect(result.discountAmount).toBeGreaterThan(0);
      expect(result.finalPrice).toBeLessThan(120000);
    });

    it('should apply custom discount', () => {
      const result = PaymentCalculator.calculateSubscriptionPrice(
        10000,
        'yearly',
        0.3 // 30% discount
      );

      expect(result.discountRate).toBe(0.3);
      expect(result.discountAmount).toBe(36000);
      expect(result.finalPrice).toBe(84000);
    });
  });

  describe('calculateRefund', () => {
    it('should calculate full refund', () => {
      const result = PaymentCalculator.calculateRefund(10000, 'full');

      expect(result.refundAmount).toBe(10000);
      expect(result.retainedFees).toBe(0);
    });

    it('should calculate partial refund', () => {
      const result = PaymentCalculator.calculateRefund(10000, 'partial', 0.5);

      expect(result.refundAmount).toBe(5000);
      expect(result.retainedAmount).toBe(5000);
    });

    it('should calculate prorated refund', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const cancelDate = new Date('2024-01-15'); // Mid-month

      const result = PaymentCalculator.calculateRefund(
        10000,
        'prorated',
        undefined,
        startDate,
        endDate,
        cancelDate
      );

      // Used about half the period
      expect(result.refundAmount).toBeGreaterThan(4000);
      expect(result.refundAmount).toBeLessThan(6000);
    });
  });

  describe('validateAmount', () => {
    it('should validate correct amounts', () => {
      expect(PaymentCalculator.validateAmount(1000)).toBe(true);
      expect(PaymentCalculator.validateAmount(100000)).toBe(true);
    });

    it('should reject amounts below minimum', () => {
      expect(PaymentCalculator.validateAmount(100)).toBe(false);
    });

    it('should reject amounts above maximum', () => {
      expect(PaymentCalculator.validateAmount(100000000)).toBe(false);
    });

    it('should reject negative amounts', () => {
      expect(PaymentCalculator.validateAmount(-1000)).toBe(false);
    });

    it('should reject non-integer amounts', () => {
      expect(PaymentCalculator.validateAmount(1000.5)).toBe(false);
    });
  });
});

describe('Fee Constants', () => {
  it('should have correct platform fee rate', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.1); // 10%
  });

  it('should have correct Stripe fee rate', () => {
    expect(STRIPE_FEE_RATE).toBe(0.034); // 3.4%
  });

  it('should have correct Stripe fixed fee', () => {
    expect(STRIPE_FEE_FIXED).toBe(400); // 400 KRW
  });
});
