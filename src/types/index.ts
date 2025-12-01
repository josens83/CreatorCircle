// 공통 타입 정의

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  details?: Record<string, string>;
}

// 서클 관련 타입
export interface CirclePricing {
  hasFreeTier: boolean;
  monthlyPrice?: number;
  yearlyPrice?: number;
  yearlyDiscount?: number;
  lifetimePrice?: number;
  lifetimeEnabled?: boolean;
  trialDays?: number;
  currency: "KRW" | "USD";
}

export interface CircleSettings {
  allowComments: boolean;
  allowMemberPosts: boolean;
  requireApproval: boolean;
  welcomeMessage?: string;
  customDomain?: string;
}

export interface CreatorLinks {
  website?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  linkedin?: string;
}

// 이메일 캠페인 통계
export interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
}

// 정산 상세
export interface PayoutBreakdown {
  subscriptions: number;
  products: number;
  tips: number;
  referralCommissions: number;
  refunds: number;
}

// 제휴 마케팅 자료
export interface MarketingAssets {
  banners: string[];
  emailTemplates: string[];
  socialPosts: string[];
}

// 크리에이터 레벨
export interface CreatorLevel {
  name: string;
  minRevenue: number;
  badge: string;
  perks: string[];
}

export const CREATOR_LEVELS: Record<string, CreatorLevel> = {
  starter: { name: "Starter", minRevenue: 0, badge: "🌱", perks: [] },
  rising: {
    name: "Rising",
    minRevenue: 100000,
    badge: "⭐",
    perks: ["배지 표시"],
  },
  established: {
    name: "Established",
    minRevenue: 500000,
    badge: "🌟",
    perks: ["우선 지원", "프로모션"],
  },
  pro: {
    name: "Pro",
    minRevenue: 2000000,
    badge: "💫",
    perks: ["전담 매니저", "수수료 8%"],
  },
  elite: {
    name: "Elite",
    minRevenue: 10000000,
    badge: "👑",
    perks: ["수수료 5%", "VIP 이벤트"],
  },
};

// 플랫폼 수수료
export const PLATFORM_FEES = {
  subscription: 0.1, // 10%
  product: 0.1, // 10%
  tip: 0.05, // 5%
  processing: 0.029, // 2.9%
  processingFixed: 300, // ₩300
} as const;

// 카테고리 레이블
export const CATEGORY_LABELS: Record<string, string> = {
  TECH: "기술/개발",
  BUSINESS: "비즈니스/창업",
  FINANCE: "투자/재테크",
  CAREER: "커리어/취업",
  MARKETING: "마케팅/그로스",
  DESIGN: "디자인/UX",
  WRITING: "글쓰기/콘텐츠",
  LIFESTYLE: "라이프스타일",
  EDUCATION: "교육/학습",
  ENTERTAINMENT: "엔터테인먼트",
};

// 멤버십 티어 배지
export const TIER_BADGES: Record<string, { color: string; label: string }> = {
  free: { color: "gray", label: "무료" },
  basic: { color: "blue", label: "베이직" },
  premium: { color: "violet", label: "프리미엄" },
  vip: { color: "gold", label: "VIP" },
};
