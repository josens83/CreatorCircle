/**
 * Fallback & Graceful Degradation System
 *
 * Netflix/Spotify 스타일의 폴백 시스템
 * - Stale-While-Revalidate 패턴
 * - 다단계 폴백
 * - 캐시 기반 복원력
 */

// ============================================
// Types
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  source: 'fresh' | 'stale' | 'fallback';
}

export interface FallbackConfig<T> {
  /** 캐시 키 */
  key: string;
  /** 캐시 TTL (ms) - 기본 5분 */
  ttl?: number;
  /** Stale 허용 시간 (ms) - 기본 30분 */
  staleTtl?: number;
  /** 폴백 함수 */
  fallbackFn?: () => Promise<T> | T;
  /** 기본값 */
  defaultValue?: T;
  /** 백그라운드 리프레시 여부 */
  backgroundRefresh?: boolean;
  /** 폴백 사용 시 콜백 */
  onFallback?: (source: string, error?: Error) => void;
}

// ============================================
// In-Memory Cache (Redis 연동 전 임시)
// ============================================

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 5분마다 만료된 캐시 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return entry as CacheEntry<T>;
  }

  set<T>(key: string, data: T, source: CacheEntry<T>['source'] = 'fresh'): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      source,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1시간 이상 된 엔트리 삭제

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

const cache = new MemoryCache();

// ============================================
// Fallback Service
// ============================================

export class FallbackService {
  /**
   * Stale-While-Revalidate 패턴으로 데이터 조회
   */
  async swr<T>(
    primaryFn: () => Promise<T>,
    config: FallbackConfig<T>
  ): Promise<T> {
    const {
      key,
      ttl = 5 * 60 * 1000,       // 5분
      staleTtl = 30 * 60 * 1000, // 30분
      fallbackFn,
      defaultValue,
      backgroundRefresh = true,
      onFallback,
    } = config;

    const cached = cache.get<T>(key);
    const now = Date.now();

    // 1. 신선한 캐시가 있으면 바로 반환
    if (cached && now - cached.timestamp < ttl) {
      return cached.data;
    }

    // 2. Stale 캐시가 있으면 반환하고 백그라운드 리프레시
    if (cached && now - cached.timestamp < staleTtl) {
      if (backgroundRefresh) {
        // 백그라운드에서 새 데이터 가져오기 (응답 대기 X)
        this.refreshInBackground(key, primaryFn).catch(() => {
          // 실패해도 무시 (stale 데이터 사용 중)
        });
      }
      onFallback?.('stale');
      return cached.data;
    }

    // 3. 신선한 데이터 가져오기 시도
    try {
      const freshData = await primaryFn();
      cache.set(key, freshData, 'fresh');
      return freshData;
    } catch (primaryError) {
      console.error(`[Fallback:${key}] Primary fetch failed:`, primaryError);

      // 4. 만료된 캐시라도 사용
      if (cached) {
        console.warn(`[Fallback:${key}] Using stale cache (${this.formatAge(now - cached.timestamp)} old)`);
        onFallback?.('expired_cache', primaryError as Error);
        return cached.data;
      }

      // 5. 폴백 함수 시도
      if (fallbackFn) {
        try {
          console.warn(`[Fallback:${key}] Using fallback function`);
          const fallbackData = await fallbackFn();
          cache.set(key, fallbackData, 'fallback');
          onFallback?.('fallback', primaryError as Error);
          return fallbackData;
        } catch (fallbackError) {
          console.error(`[Fallback:${key}] Fallback function failed:`, fallbackError);
        }
      }

      // 6. 기본값 사용
      if (defaultValue !== undefined) {
        console.warn(`[Fallback:${key}] Using default value`);
        onFallback?.('default', primaryError as Error);
        return defaultValue;
      }

      // 7. 모든 폴백 실패
      throw primaryError;
    }
  }

  /**
   * 백그라운드에서 데이터 갱신
   */
  private async refreshInBackground<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<void> {
    try {
      const data = await fn();
      cache.set(key, data, 'fresh');
      console.log(`[Fallback:${key}] Background refresh successful`);
    } catch (error) {
      console.warn(`[Fallback:${key}] Background refresh failed:`, error);
    }
  }

  /**
   * 시간 포맷팅
   */
  private formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  }

  /**
   * 캐시 무효화
   */
  invalidate(key: string): void {
    cache.delete(key);
  }

  /**
   * 패턴 매칭으로 캐시 무효화
   */
  invalidatePattern(pattern: string): void {
    // 간단한 와일드카드 지원
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    // Note: MemoryCache에서는 직접 구현 필요
    // Redis에서는 SCAN + DEL 사용
  }
}

// 싱글톤 인스턴스
export const fallback = new FallbackService();

// ============================================
// Higher-Order Functions for Common Patterns
// ============================================

/**
 * 폴백이 적용된 데이터 조회 함수 생성
 */
export function createFallbackFetcher<T>(
  config: Omit<FallbackConfig<T>, 'key'> & { keyPrefix: string }
) {
  return async (
    id: string,
    fetcher: () => Promise<T>
  ): Promise<T> => {
    return fallback.swr(fetcher, {
      ...config,
      key: `${config.keyPrefix}:${id}`,
    });
  };
}

// ============================================
// Pre-configured Fallback Fetchers
// ============================================

/**
 * 사용자 데이터 조회 (5분 캐시)
 */
export const fetchUserWithFallback = createFallbackFetcher<unknown>({
  keyPrefix: 'user',
  ttl: 5 * 60 * 1000,
  staleTtl: 30 * 60 * 1000,
  backgroundRefresh: true,
});

/**
 * 서클 데이터 조회 (10분 캐시)
 */
export const fetchCircleWithFallback = createFallbackFetcher<unknown>({
  keyPrefix: 'circle',
  ttl: 10 * 60 * 1000,
  staleTtl: 60 * 60 * 1000,
  backgroundRefresh: true,
});

/**
 * 인기 콘텐츠 조회 (1분 캐시, 높은 트래픽)
 */
export const fetchPopularWithFallback = createFallbackFetcher<unknown[]>({
  keyPrefix: 'popular',
  ttl: 60 * 1000,
  staleTtl: 5 * 60 * 1000,
  backgroundRefresh: true,
  defaultValue: [],
});

// ============================================
// Graceful Degradation Utilities
// ============================================

export interface DegradedFeature {
  name: string;
  available: boolean;
  reason?: string;
  fallbackBehavior?: string;
}

/**
 * 기능별 가용성 상태 관리
 */
class FeatureAvailability {
  private features = new Map<string, DegradedFeature>();

  setAvailable(name: string): void {
    this.features.set(name, { name, available: true });
  }

  setDegraded(
    name: string,
    reason: string,
    fallbackBehavior?: string
  ): void {
    this.features.set(name, {
      name,
      available: false,
      reason,
      fallbackBehavior,
    });
    console.warn(`[Degradation] ${name}: ${reason}`);
  }

  isAvailable(name: string): boolean {
    return this.features.get(name)?.available ?? true;
  }

  getStatus(): DegradedFeature[] {
    return Array.from(this.features.values());
  }

  getDegraded(): DegradedFeature[] {
    return this.getStatus().filter(f => !f.available);
  }
}

export const featureAvailability = new FeatureAvailability();

/**
 * 기능 가용성에 따라 실행
 */
export async function withGracefulDegradation<T>(
  featureName: string,
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T,
  fallbackBehavior: string
): Promise<T> {
  // 이미 degraded 상태면 바로 폴백
  if (!featureAvailability.isAvailable(featureName)) {
    return fallbackFn();
  }

  try {
    const result = await primaryFn();
    featureAvailability.setAvailable(featureName);
    return result;
  } catch (error) {
    console.error(`[GracefulDegradation:${featureName}] Failed:`, error);
    featureAvailability.setDegraded(
      featureName,
      (error as Error).message,
      fallbackBehavior
    );
    return fallbackFn();
  }
}

// ============================================
// Export Index
// ============================================

export { cache as fallbackCache };
