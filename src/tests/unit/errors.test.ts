/**
 * Error Classes Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  PaymentError,
  ExternalServiceError,
  isAppError,
  isOperationalError,
} from '@/lib/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with all properties', () => {
      const error = new AppError(
        'TEST_ERROR',
        'Test error message',
        500,
        true,
        { key: 'value' }
      );

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ key: 'value' });
      expect(error.name).toBe('AppError');
    });

    it('should default isOperational to true', () => {
      const error = new AppError('TEST', 'Test', 500);
      expect(error.isOperational).toBe(true);
    });

    it('should be instanceof Error', () => {
      const error = new AppError('TEST', 'Test', 500);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have a stack trace', () => {
      const error = new AppError('TEST', 'Test', 500);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field errors', () => {
      const error = new ValidationError('Invalid input', {
        email: '이메일 형식이 올바르지 않습니다',
        password: '비밀번호는 최소 8자 이상이어야 합니다',
      });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.context?.errors).toEqual({
        email: '이메일 형식이 올바르지 않습니다',
        password: '비밀번호는 최소 8자 이상이어야 합니다',
      });
    });

    it('should create validation error without field errors', () => {
      const error = new ValidationError('Invalid input');
      expect(error.context).toBeUndefined();
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('User', 'user-123');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
      expect(error.context?.resourceType).toBe('User');
      expect(error.context?.resourceId).toBe('user-123');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error', () => {
      const error = new UnauthorizedError('Token expired');

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Token expired');
    });

    it('should use default message', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('인증이 필요합니다');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Email already exists');

      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError(60);

      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.context?.retryAfter).toBe(60);
    });
  });

  describe('PaymentError', () => {
    it('should create payment error with details', () => {
      const error = new PaymentError(
        'CARD_DECLINED',
        'Your card was declined',
        { declineCode: 'insufficient_funds' }
      );

      expect(error.code).toBe('CARD_DECLINED');
      expect(error.statusCode).toBe(402);
      expect(error.context?.declineCode).toBe('insufficient_funds');
    });
  });

  describe('ExternalServiceError', () => {
    it('should create external service error', () => {
      const originalError = new Error('Connection refused');
      const error = new ExternalServiceError('Stripe', originalError);

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.message).toContain('Stripe');
      expect(error.context?.service).toBe('Stripe');
      expect(error.context?.originalError).toBe('Connection refused');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError('TEST', 'Test', 500);
      expect(isAppError(error)).toBe(true);
    });

    it('should return true for subclasses', () => {
      expect(isAppError(new ValidationError('Test'))).toBe(true);
      expect(isAppError(new NotFoundError('Test'))).toBe(true);
      expect(isAppError(new PaymentError('TEST', 'Test'))).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isAppError(new Error('Test'))).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({ code: 'TEST' })).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      const error = new AppError('TEST', 'Test', 500, true);
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      const error = new AppError('TEST', 'Test', 500, false);
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for regular errors', () => {
      expect(isOperationalError(new Error('Test'))).toBe(false);
    });
  });
});
