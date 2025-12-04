/**
 * Performance Monitoring Hooks
 * React hooks for client-side performance optimization
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useTransition,
} from 'react';

// =============================================================================
// Types
// =============================================================================

export interface PerformanceMetrics {
  fcp: number | null;  // First Contentful Paint
  lcp: number | null;  // Largest Contentful Paint
  fid: number | null;  // First Input Delay
  cls: number | null;  // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  inp: number | null;  // Interaction to Next Paint
}

export interface ResourceTiming {
  name: string;
  duration: number;
  startTime: number;
  transferSize: number;
  type: string;
}

// =============================================================================
// Core Web Vitals Hook
// =============================================================================

/**
 * Track Core Web Vitals metrics
 */
export function useWebVitals(onReport?: (metrics: PerformanceMetrics) => void) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    inp: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcp = entries.find((e) => e.name === 'first-contentful-paint');
      if (fcp) {
        setMetrics((prev) => ({ ...prev, fcp: fcp.startTime }));
      }
    });

    try {
      fcpObserver.observe({ type: 'paint', buffered: true });
    } catch {
      // Observer not supported
    }

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lcp = entries[entries.length - 1];
      if (lcp) {
        setMetrics((prev) => ({ ...prev, lcp: lcp.startTime }));
      }
    });

    try {
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Observer not supported
    }

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fid = entries[0] as PerformanceEventTiming;
      if (fid) {
        setMetrics((prev) => ({
          ...prev,
          fid: fid.processingStart - fid.startTime,
        }));
      }
    });

    try {
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch {
      // Observer not supported
    }

    // Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
          setMetrics((prev) => ({ ...prev, cls: clsValue }));
        }
      }
    });

    try {
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Observer not supported
    }

    // Time to First Byte
    const navEntry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming;
    if (navEntry) {
      setMetrics((prev) => ({
        ...prev,
        ttfb: navEntry.responseStart - navEntry.requestStart,
      }));
    }

    return () => {
      fcpObserver.disconnect();
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
    };
  }, []);

  // Report metrics when all are collected
  useEffect(() => {
    if (onReport && metrics.fcp && metrics.lcp) {
      onReport(metrics);
    }
  }, [metrics, onReport]);

  return metrics;
}

// =============================================================================
// Debounce Hook
// =============================================================================

/**
 * Debounce a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// =============================================================================
// Throttle Hook
// =============================================================================

/**
 * Throttled callback
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(
          () => {
            lastRun.current = Date.now();
            callback(...args);
          },
          delay - (now - lastRun.current)
        );
      }
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

// =============================================================================
// Intersection Observer Hook
// =============================================================================

interface UseIntersectionOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

/**
 * Intersection observer for lazy loading
 */
export function useIntersection(
  options: UseIntersectionOptions = {}
): [React.RefCallback<Element>, boolean, IntersectionObserverEntry | null] {
  const { threshold = 0, root = null, rootMargin = '0px', freezeOnceVisible = false } = options;

  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [node, setNode] = useState<Element | null>(null);
  const frozen = useRef(false);

  const isIntersecting = entry?.isIntersecting ?? false;

  useEffect(() => {
    if (!node) return;
    if (frozen.current && freezeOnceVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);

        if (entry.isIntersecting && freezeOnceVisible) {
          frozen.current = true;
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node, threshold, root, rootMargin, freezeOnceVisible]);

  const ref = useCallback((node: Element | null) => {
    setNode(node);
  }, []);

  return [ref, isIntersecting, entry];
}

// =============================================================================
// Virtual List Hook
// =============================================================================

interface VirtualListOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
}

interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

/**
 * Virtual scrolling for large lists
 */
export function useVirtualList(
  containerRef: React.RefObject<HTMLElement>,
  options: VirtualListOptions
): {
  virtualItems: VirtualItem[];
  totalSize: number;
  scrollTo: (index: number) => void;
} {
  const { itemCount, itemHeight, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setContainerHeight(container.clientHeight);
    };

    handleResize();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef]);

  const virtualItems = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan
    );
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const items: VirtualItem[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        size: itemHeight,
      });
    }

    return items;
  }, [scrollTop, containerHeight, itemCount, itemHeight, overscan]);

  const scrollTo = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = index * itemHeight;
      }
    },
    [containerRef, itemHeight]
  );

  return {
    virtualItems,
    totalSize: itemCount * itemHeight,
    scrollTo,
  };
}

// =============================================================================
// Transition Hook for Non-Urgent Updates
// =============================================================================

/**
 * Wrap state updates in transitions for better UX
 */
export function useDeferredState<T>(
  initialValue: T
): [T, T, (value: T) => void] {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const deferredValue = useMemo(() => value, [value]);

  const setDeferredValue = useCallback((newValue: T) => {
    startTransition(() => {
      setValue(newValue);
    });
  }, []);

  return [value, deferredValue, setDeferredValue];
}

// =============================================================================
// Previous Value Hook
// =============================================================================

/**
 * Get previous value of a state
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// =============================================================================
// Idle Callback Hook
// =============================================================================

/**
 * Execute callback when browser is idle
 */
export function useIdleCallback(
  callback: () => void,
  options: { timeout?: number } = {}
): void {
  const { timeout = 1000 } = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback, { timeout });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(callback, 1);
      return () => clearTimeout(id);
    }
  }, [callback, timeout]);
}

// =============================================================================
// Memory Usage Hook
// =============================================================================

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Monitor memory usage
 */
export function useMemoryUsage(intervalMs: number = 5000): MemoryInfo | null {
  const [memory, setMemory] = useState<MemoryInfo | null>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('performance' in window) ||
      !(performance as Performance & { memory?: MemoryInfo }).memory
    ) {
      return;
    }

    const updateMemory = () => {
      const mem = (performance as Performance & { memory?: MemoryInfo }).memory;
      if (mem) {
        setMemory({
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
        });
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return memory;
}

// =============================================================================
// Resource Loading Hook
// =============================================================================

/**
 * Track resource loading performance
 */
export function useResourceTiming(): ResourceTiming[] {
  const [resources, setResources] = useState<ResourceTiming[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list
        .getEntries()
        .filter((e) => e.entryType === 'resource')
        .map((e) => {
          const resource = e as PerformanceResourceTiming;
          return {
            name: resource.name,
            duration: resource.duration,
            startTime: resource.startTime,
            transferSize: resource.transferSize,
            type: resource.initiatorType,
          };
        });

      setResources((prev) => [...prev, ...entries]);
    });

    try {
      observer.observe({ type: 'resource', buffered: true });
    } catch {
      // Observer not supported
    }

    return () => observer.disconnect();
  }, []);

  return resources;
}

// =============================================================================
// Render Count Hook (Development)
// =============================================================================

/**
 * Track component render count (development only)
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);

  renderCount.current += 1;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Render] ${componentName}: ${renderCount.current}`);
  }

  return renderCount.current;
}
