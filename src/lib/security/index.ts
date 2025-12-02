/**
 * Security Module Exports
 *
 * 은행/Stripe 수준의 보안 시스템
 */

// Security Middleware
export {
  securityMiddleware,
  SECURITY_PATHS,
  API_PATHS,
  STATIC_PATHS,
} from './middleware';

// Rate Limiting
export {
  RateLimiter,
  getIdentifier,
  getClientIP,
  authLimiter,
  signupLimiter,
  passwordResetLimiter,
  apiLimiter,
  paymentLimiter,
  uploadLimiter,
  contentLimiter,
  searchLimiter,
  webhookLimiter,
  rateLimiters,
  getRateLimiterForPath,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter';

// Input Sanitization
export {
  sanitizeHtml,
  stripHtml,
  escapeHtml,
  sanitizeString,
  sanitizeSlug,
  sanitizeFilename,
  detectSqlInjection,
  isSqlSafe,
  // Zod Schemas
  emailSchema,
  passwordSchema,
  usernameSchema,
  nameSchema,
  urlSchema,
  slugSchema,
  phoneSchema,
  amountSchema,
  richTextSchema,
  plainTextSchema,
  imageFileSchema,
  documentFileSchema,
  videoFileSchema,
  validateFileExtension,
  // Constants
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_VIDEO_TYPES,
  COMMON_PASSWORDS,
  RESERVED_USERNAMES,
} from './sanitize';

// Audit Logging
export {
  audit,
  isHighSeverity,
  isSecurityEvent,
  isPaymentEvent,
  type AuditCategory,
  type AuditSeverity,
  type AuditEvent,
} from './audit';

// Token Management
export {
  generateSecureToken,
  hashToken,
  createToken,
  emailVerification,
  passwordReset,
  apiKey,
  isValidTokenFormat,
  generateTOTP,
  verifyTOTP,
  type TokenType,
  type Token,
} from './tokens';
