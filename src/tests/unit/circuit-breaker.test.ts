/**
 * Circuit Breaker Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
} from '@/lib/resilience/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = new CircuitBreaker({
      name: 'test',
      timeout: 1000,
      errorThreshold: 50,
      volumeThreshold: 3,
      resetTimeout: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should return circuit name', () => {
      expect(circuitBreaker.getName()).toBe('test');
    });
  });

  describe('successful execution', () => {
    it('should execute function and return result', async () => {
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should remain CLOSED after successful executions', async () => {
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('failure handling', () => {
    it('should remain CLOSED when error threshold not reached', async () => {
      // 1 failure out of 3 = 33%, below 50% threshold
      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('fail');
        })
      ).rejects.toThrow('fail');

      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit when error threshold exceeded', async () => {
      // Need to exceed volumeThreshold (3) and errorThreshold (50%)
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Force circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
    });

    it('should reject requests immediately when OPEN', async () => {
      await expect(
        circuitBreaker.execute(async () => 'success')
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Advance time past reset timeout
      vi.advanceTimersByTime(5001);

      // The next execute will transition to HALF_OPEN
      // and allow the request through
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Force circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      // Advance to HALF_OPEN
      vi.advanceTimersByTime(5001);
    });

    it('should close circuit on success in HALF_OPEN', async () => {
      await circuitBreaker.execute(async () => 'success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in HALF_OPEN', async () => {
      // First call transitions to HALF_OPEN and tries
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('timeout handling', () => {
    it('should timeout slow operations', async () => {
      const slowOperation = () =>
        new Promise((resolve) => setTimeout(resolve, 2000));

      await expect(circuitBreaker.execute(slowOperation)).rejects.toThrow(
        'Circuit breaker timeout'
      );
    });
  });

  describe('fallback', () => {
    it('should use fallback when circuit is OPEN', async () => {
      // Force circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      const result = await circuitBreaker.execute(
        async () => 'primary',
        async () => 'fallback'
      );

      expect(result).toBe('fallback');
    });

    it('should use fallback when operation fails', async () => {
      const result = await circuitBreaker.execute(
        async () => {
          throw new Error('fail');
        },
        async () => 'fallback'
      );

      expect(result).toBe('fallback');
    });
  });

  describe('statistics', () => {
    it('should track success count', async () => {
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');

      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(2);
    });

    it('should track failure count', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });

    it('should track timeout count', async () => {
      const slowOperation = () =>
        new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        await circuitBreaker.execute(slowOperation);
      } catch {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      expect(stats.timeouts).toBe(1);
    });

    it('should reset statistics', () => {
      circuitBreaker.resetStats();
      const stats = circuitBreaker.getStats();

      expect(stats.successes).toBe(0);
      expect(stats.failures).toBe(0);
      expect(stats.timeouts).toBe(0);
    });
  });

  describe('event callbacks', () => {
    it('should call onOpen when circuit opens', async () => {
      const onOpen = vi.fn();
      const cb = new CircuitBreaker({
        name: 'test',
        timeout: 1000,
        errorThreshold: 50,
        volumeThreshold: 2,
        resetTimeout: 5000,
        onOpen,
      });

      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when circuit closes', async () => {
      const onClose = vi.fn();
      const cb = new CircuitBreaker({
        name: 'test',
        timeout: 1000,
        errorThreshold: 50,
        volumeThreshold: 2,
        resetTimeout: 5000,
        onClose,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      // Wait for reset timeout
      vi.advanceTimersByTime(5001);

      // Success should close the circuit
      await cb.execute(async () => 'success');

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
