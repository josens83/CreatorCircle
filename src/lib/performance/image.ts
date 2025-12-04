/**
 * Image Optimization Utilities
 * Netflix/Spotify-grade image handling
 */

// =============================================================================
// Types
// =============================================================================

export interface ImageConfig {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

export interface ResponsiveImageConfig extends ImageConfig {
  sizes?: string;
  srcSet?: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

// =============================================================================
// Image URL Generators
// =============================================================================

const CDN_BASE_URL = process.env.NEXT_PUBLIC_CDN_URL || '';
const DEFAULT_QUALITY = 75;

/**
 * Generate optimized image URL with transformations
 */
export function getOptimizedImageUrl(
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
    fit?: 'cover' | 'contain' | 'fill';
  } = {}
): string {
  const { width, height, quality = DEFAULT_QUALITY, format = 'webp', fit = 'cover' } = options;

  // If it's already an optimized URL or external URL, return as-is
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  // If using a CDN with transformation support
  if (CDN_BASE_URL && !src.startsWith('http')) {
    const params = new URLSearchParams();
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    params.set('q', quality.toString());
    params.set('fm', format);
    params.set('fit', fit);

    return `${CDN_BASE_URL}${src}?${params.toString()}`;
  }

  // For Next.js Image optimization
  if (src.startsWith('/')) {
    const params = new URLSearchParams();
    params.set('url', src);
    if (width) params.set('w', width.toString());
    params.set('q', quality.toString());

    return `/_next/image?${params.toString()}`;
  }

  return src;
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(
  src: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1536],
  quality: number = DEFAULT_QUALITY
): string {
  return widths
    .map((width) => {
      const url = getOptimizedImageUrl(src, { width, quality });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(breakpoints: {
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  default: string;
}): string {
  const parts: string[] = [];

  if (breakpoints.xl) parts.push(`(min-width: 1280px) ${breakpoints.xl}`);
  if (breakpoints.lg) parts.push(`(min-width: 1024px) ${breakpoints.lg}`);
  if (breakpoints.md) parts.push(`(min-width: 768px) ${breakpoints.md}`);
  if (breakpoints.sm) parts.push(`(min-width: 640px) ${breakpoints.sm}`);
  parts.push(breakpoints.default);

  return parts.join(', ');
}

// =============================================================================
// Blur Placeholder Generation
// =============================================================================

/**
 * Generate a tiny blur placeholder (LQIP - Low Quality Image Placeholder)
 * This is a base64 encoded tiny image
 */
export function generateBlurPlaceholder(
  width: number = 10,
  height: number = 10,
  color: string = '#e5e7eb'
): string {
  // Create a simple SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Generate shimmer placeholder animation
 */
export function generateShimmerPlaceholder(
  width: number,
  height: number
): string {
  const shimmer = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f3f4f6">
            <animate attributeName="offset" values="-2; 1" dur="1.5s" repeatCount="indefinite"/>
          </stop>
          <stop offset="50%" style="stop-color:#e5e7eb">
            <animate attributeName="offset" values="-1; 2" dur="1.5s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%" style="stop-color:#f3f4f6">
            <animate attributeName="offset" values="0; 3" dur="1.5s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#shimmer)"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(shimmer).toString('base64')}`;
}

// =============================================================================
// Aspect Ratio Utilities
// =============================================================================

export const ASPECT_RATIOS = {
  square: 1,
  portrait: 3 / 4,
  landscape: 4 / 3,
  wide: 16 / 9,
  ultrawide: 21 / 9,
  thumbnail: 1.5,
  banner: 3,
} as const;

export type AspectRatioName = keyof typeof ASPECT_RATIOS;

/**
 * Calculate dimensions maintaining aspect ratio
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth?: number,
  maxHeight?: number
): ImageDimensions {
  const aspectRatio = originalWidth / originalHeight;

  let width = originalWidth;
  let height = originalHeight;

  if (maxWidth && width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }

  if (maxHeight && height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return { width, height, aspectRatio };
}

/**
 * Get dimensions for a specific aspect ratio
 */
export function getDimensionsForAspectRatio(
  baseWidth: number,
  ratio: AspectRatioName | number
): ImageDimensions {
  const aspectRatio = typeof ratio === 'number' ? ratio : ASPECT_RATIOS[ratio];
  const height = Math.round(baseWidth / aspectRatio);

  return { width: baseWidth, height, aspectRatio };
}

// =============================================================================
// Lazy Loading Utilities
// =============================================================================

/**
 * Check if image is in viewport
 */
export function isInViewport(element: HTMLElement, threshold: number = 0): boolean {
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.top <= windowHeight + threshold &&
    rect.bottom >= -threshold &&
    rect.left <= windowWidth + threshold &&
    rect.right >= -threshold
  );
}

/**
 * Create intersection observer for lazy loading
 */
export function createLazyLoadObserver(
  onIntersect: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px 0px',
    threshold: 0,
    ...options,
  };

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        onIntersect(entry);
      }
    });
  }, defaultOptions);
}

// =============================================================================
// Image Preloading
// =============================================================================

const preloadedImages = new Set<string>();

/**
 * Preload an image
 */
export function preloadImage(src: string): Promise<void> {
  if (preloadedImages.has(src)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      preloadedImages.add(src);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images
 */
export function preloadImages(sources: string[]): Promise<void[]> {
  return Promise.all(sources.map(preloadImage));
}

/**
 * Preload image with priority hint
 */
export function preloadImageWithPriority(
  src: string,
  priority: 'high' | 'low' | 'auto' = 'auto'
): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.fetchPriority = priority;

  document.head.appendChild(link);
}

// =============================================================================
// Avatar/Profile Image Utilities
// =============================================================================

const AVATAR_SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
  '2xl': 128,
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * Get avatar configuration
 */
export function getAvatarConfig(
  src: string | null | undefined,
  name: string,
  size: AvatarSize = 'md'
): {
  src: string;
  width: number;
  height: number;
  fallback: string;
} {
  const dimension = AVATAR_SIZES[size];

  if (src) {
    return {
      src: getOptimizedImageUrl(src, {
        width: dimension * 2, // 2x for retina
        height: dimension * 2,
        fit: 'cover',
      }),
      width: dimension,
      height: dimension,
      fallback: getInitials(name),
    };
  }

  return {
    src: generateAvatarPlaceholder(name, dimension),
    width: dimension,
    height: dimension,
    fallback: getInitials(name),
  };
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate avatar placeholder with initials
 */
function generateAvatarPlaceholder(name: string, size: number): string {
  const initials = getInitials(name);
  const backgroundColor = stringToColor(name);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="100%" height="100%" fill="${backgroundColor}"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
            fill="white" font-family="sans-serif" font-size="${size * 0.4}" font-weight="500">
        ${initials}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Generate consistent color from string
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#84cc16', // lime
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
  ];

  return colors[Math.abs(hash) % colors.length];
}
