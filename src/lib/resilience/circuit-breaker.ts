/**
 * Circuit Breaker Pattern Implementation
 *
 * Netflix Hystrix 스타일의 서킷 브레이커
 * - 연쇄 장애 방지
 * - 빠른 실패 (Fast Fail)
 * - 자동 복구
 */

import { ServiceUnavailableError, GatewayTimeoutError } from '../errors';

// ============================================
// Types
// ============================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** 요청 타임아웃 (ms) - 기본 3초 */
  timeout: number;
  /** 에러율 임계값 (%) - 기본 50% */
  errorThreshold: number;
  /** 최소 요청 수 - 기본 10개 */
  volumeThreshold: number;
  /** 회로 열림 후 복구 시도까지 대기 시간 (ms) - 기본 30초 */
  resetTimeout: number;
  /** 반개방 상태에서 테스트 요청 수 - 기본 3개 */
  halfOpenRequests: number;
  /** 서킷 이름 (로깅용) */
  name: string;
  /** 상태 변경 콜백 */
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime?: number;
  halfOpenAttempts: number;
}

// ============================================
// Circuit Breaker Implementation
// ============================================

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private stats: CircuitStats = {
    failures: 0,
    successes: 0,
    halfOpenAttempts: 0,
  };
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = {
      timeout: 3000,
      errorThreshold: 50,
      volumeThreshold: 10,
      resetTimeout: 30000,
      halfOpenRequests: 3,
      ...config,
    };
  }

  /**
   * 서킷 브레이커로 보호된 함수 실행
   */
  async fire<T>(fn: () => Promise<T>): Promise<T> {
    // 1. 회로가 열려있으면 빠른 실패
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new ServiceUnavailableError(
          `${this.config.name} (Circuit Breaker OPEN)`
        );
      }
    }

    // 2. 반개방 상태에서 너무 많은 요청 방지
    if (this.state === 'HALF_OPEN') {
      if (this.stats.halfOpenAttempts >= this.config.halfOpenRequests) {
        throw new ServiceUnavailableError(
          `${this.config.name} (Circuit Breaker HALF_OPEN - max attempts reached)`
        );
      }
      this.stats.halfOpenAttempts++;
    }

    // 3. 타임아웃과 함께 실행
    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 타임아웃이 적용된 함수 실행
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new GatewayTimeoutError(this.config.name)),
          this.config.timeout
        )
      ),
    ]);
  }

  /**
   * 성공 시 통계 업데이트
   */
  private onSuccess(): void {
    this.stats.successes++;

    if (this.state === 'HALF_OPEN') {
      // 반개방 상태에서 성공하면 회로 닫기
      this.transitionTo('CLOSED');
      this.resetStats();
    }
  }

  /**
   * 실패 시 통계 업데이트
   */
  private onFailure(): void {
    this.stats.failures++;
    this.stats.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // 반개방 상태에서 실패하면 다시 열기
      this.transitionTo('OPEN');
      this.stats.halfOpenAttempts = 0;
      return;
    }

    // 닫힌 상태에서 임계값 확인
    if (this.shouldOpen()) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * 회로를 열어야 하는지 확인
   */
  private shouldOpen(): boolean {
    const totalRequests = this.stats.failures + this.stats.successes;

    // 최소 요청 수 미달
    if (totalRequests < this.config.volumeThreshold) {
      return false;
    }

    // 에러율 계산
    const errorRate = (this.stats.failures / totalRequests) * 100;
    return errorRate >= this.config.errorThreshold;
  }

  /**
   * 복구 시도를 해야 하는지 확인
   */
  private shouldAttemptReset(): boolean {
    if (!this.stats.lastFailureTime) {
      return true;
    }

    return Date.now() - this.stats.lastFailureTime >= this.config.resetTimeout;
  }

  /**
   * 상태 전이
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    // 콜백 호출
    if (this.config.onStateChange) {
      this.config.onStateChange(oldState, newState, this.config.name);
    }

    // 로깅
    console.log(
      `[CircuitBreaker:${this.config.name}] State changed: ${oldState} -> ${newState}`
    );
  }

  /**
   * 통계 리셋
   */
  private resetStats(): void {
    this.stats = {
      failures: 0,
      successes: 0,
      halfOpenAttempts: 0,
    };
  }

  // ============================================
  // Public API for Monitoring
  // ============================================

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    const totalRequests = this.stats.failures + this.stats.successes;
    const errorRate = totalRequests > 0
      ? (this.stats.failures / totalRequests) * 100
      : 0;

    return {
      state: this.state,
      failures: this.stats.failures,
      successes: this.stats.successes,
      totalRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      lastFailureTime: this.stats.lastFailureTime
        ? new Date(this.stats.lastFailureTime).toISOString()
        : null,
    };
  }

  /**
   * 수동으로 회로 리셋 (관리자용)
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.resetStats();
  }

  /**
   * 수동으로 회로 열기 (유지보수용)
   */
  open(): void {
    this.transitionTo('OPEN');
    this.stats.lastFailureTime = Date.now();
  }
}

// ============================================
// Pre-configured Circuit Breakers
// ============================================

/**
 * 기본 상태 변경 핸들러
 */
const defaultOnStateChange = (
  from: CircuitState,
  to: CircuitState,
  name: string
) => {
  // TODO: 모니터링 시스템으로 전송
  if (to === 'OPEN') {
    console.error(`[ALERT] Circuit Breaker "${name}" is now OPEN`);
    // Slack/PagerDuty 알림 전송
  }
};

/** Stripe API용 서킷 브레이커 */
export const stripeCircuit = new CircuitBreaker({
  name: 'Stripe',
  timeout: 10000, // Stripe는 느릴 수 있음
  errorThreshold: 30,
  volumeThreshold: 5,
  resetTimeout: 60000,
  onStateChange: defaultOnStateChange,
});

/** 데이터베이스용 서킷 브레이커 */
export const dbCircuit = new CircuitBreaker({
  name: 'Database',
  timeout: 5000,
  errorThreshold: 50,
  volumeThreshold: 10,
  resetTimeout: 30000,
  onStateChange: defaultOnStateChange,
});

/** 외부 API용 서킷 브레이커 */
export const externalApiCircuit = new CircuitBreaker({
  name: 'ExternalAPI',
  timeout: 5000,
  errorThreshold: 40,
  volumeThreshold: 10,
  resetTimeout: 30000,
  onStateChange: defaultOnStateChange,
});

/** 이메일 서비스용 서킷 브레이커 */
export const emailCircuit = new CircuitBreaker({
  name: 'Email',
  timeout: 10000,
  errorThreshold: 50,
  volumeThreshold: 5,
  resetTimeout: 60000,
  onStateChange: defaultOnStateChange,
});

// ============================================
// Circuit Breaker Registry (Monitoring)
// ============================================

export const circuitRegistry = {
  stripe: stripeCircuit,
  database: dbCircuit,
  externalApi: externalApiCircuit,
  email: emailCircuit,
};

/**
 * 모든 서킷 브레이커 상태 조회 (Health Check용)
 */
export function getAllCircuitStats() {
  return Object.entries(circuitRegistry).reduce(
    (acc, [name, circuit]) => {
      acc[name] = circuit.getStats();
      return acc;
    },
    {} as Record<string, ReturnType<CircuitBreaker['getStats']>>
  );
}
