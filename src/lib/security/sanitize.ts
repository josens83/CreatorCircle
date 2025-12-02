/**
 * Input Sanitization & Validation
 *
 * OWASP 기준의 입력 검증 및 정화
 * - XSS 방어
 * - SQL Injection 방어 (Prisma가 기본 처리하지만 추가 검증)
 * - 파일 업로드 검증
 * - 비밀번호 정책
 */

import { z } from 'zod';

// ============================================
// HTML Sanitization
// ============================================

// 허용할 HTML 태그 (리치 텍스트용)
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'span', 'div',
];

// 허용할 HTML 속성
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['class', 'id', 'style'],
};

// 위험한 프로토콜
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:application',
];

/**
 * HTML 문자열 정화 (XSS 방지)
 * 주의: 프로덕션에서는 DOMPurify 사용 권장
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  // 1. Script 태그 제거
  let clean = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. 이벤트 핸들러 제거
  clean = clean.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  clean = clean.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // 3. javascript: 프로토콜 제거
  clean = clean.replace(/href\s*=\s*(['"])javascript:[^'"]*\1/gi, 'href="javascript:void(0)"');

  // 4. data: URL 제거 (이미지 제외)
  clean = clean.replace(/src\s*=\s*(['"])data:(?!image)[^'"]*\1/gi, 'src=""');

  // 5. style 내 expression/behavior 제거 (IE 취약점)
  clean = clean.replace(/expression\s*\([^)]*\)/gi, '');
  clean = clean.replace(/behavior\s*:[^;]*/gi, '');

  return clean;
}

/**
 * 평문 텍스트로 변환 (모든 HTML 제거)
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * HTML 엔티티 이스케이프
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  return text.replace(/[&<>"'`=/]/g, char => map[char]);
}

// ============================================
// String Sanitization
// ============================================

/**
 * 기본 문자열 정화
 */
export function sanitizeString(input: string): string {
  if (!input) return '';

  return input
    .trim()
    // 제어 문자 제거
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 연속 공백을 단일 공백으로
    .replace(/\s+/g, ' ');
}

/**
 * URL 안전 문자열 (slug용)
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 파일명 정화
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
}

// ============================================
// SQL Injection Prevention
// ============================================

// 위험한 SQL 패턴
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/i,
  /(--)|(\/\*)|(\*\/)/,
  /(\bOR\b.*=.*)/i,
  /(\bAND\b.*=.*)/i,
  /(;.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i,
];

/**
 * SQL Injection 패턴 감지
 */
export function detectSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * SQL 안전 문자열 검증
 */
export function isSqlSafe(input: string): boolean {
  return !detectSqlInjection(input);
}

// ============================================
// Zod Schemas for Common Inputs
// ============================================

/** 이메일 검증 */
export const emailSchema = z
  .string()
  .email('올바른 이메일 형식이 아닙니다')
  .max(255, '이메일이 너무 깁니다')
  .toLowerCase()
  .transform(email => email.trim());

/** 비밀번호 검증 (OWASP 기준) */
export const passwordSchema = z
  .string()
  .min(12, '비밀번호는 최소 12자 이상이어야 합니다')
  .max(128, '비밀번호가 너무 깁니다')
  .refine(pwd => /[a-z]/.test(pwd), '소문자를 포함해야 합니다')
  .refine(pwd => /[A-Z]/.test(pwd), '대문자를 포함해야 합니다')
  .refine(pwd => /[0-9]/.test(pwd), '숫자를 포함해야 합니다')
  .refine(pwd => /[^a-zA-Z0-9]/.test(pwd), '특수문자를 포함해야 합니다')
  .refine(pwd => !COMMON_PASSWORDS.includes(pwd.toLowerCase()), '너무 일반적인 비밀번호입니다')
  .refine(pwd => !/(.)\1{2,}/.test(pwd), '같은 문자를 3번 이상 연속 사용할 수 없습니다');

/** 사용자명 검증 */
export const usernameSchema = z
  .string()
  .min(3, '사용자명은 최소 3자 이상이어야 합니다')
  .max(30, '사용자명이 너무 깁니다')
  .regex(/^[a-zA-Z0-9_]+$/, '사용자명은 영문, 숫자, 밑줄만 사용할 수 있습니다')
  .refine(name => !RESERVED_USERNAMES.includes(name.toLowerCase()), '사용할 수 없는 사용자명입니다')
  .transform(name => name.toLowerCase());

/** 이름 검증 */
export const nameSchema = z
  .string()
  .min(1, '이름을 입력해 주세요')
  .max(100, '이름이 너무 깁니다')
  .transform(name => sanitizeString(name));

/** URL 검증 */
export const urlSchema = z
  .string()
  .url('올바른 URL 형식이 아닙니다')
  .max(2000, 'URL이 너무 깁니다')
  .refine(url => {
    const lower = url.toLowerCase();
    return !DANGEROUS_PROTOCOLS.some(p => lower.startsWith(p));
  }, '허용되지 않는 URL 프로토콜입니다');

/** 슬러그 검증 */
export const slugSchema = z
  .string()
  .min(1, '슬러그를 입력해 주세요')
  .max(100, '슬러그가 너무 깁니다')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '올바른 슬러그 형식이 아닙니다 (예: my-slug-123)');

/** 전화번호 검증 (한국) */
export const phoneSchema = z
  .string()
  .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '올바른 전화번호 형식이 아닙니다')
  .transform(phone => phone.replace(/-/g, ''));

/** 금액 검증 (원화) */
export const amountSchema = z
  .number()
  .min(0, '금액은 0 이상이어야 합니다')
  .max(100000000, '금액이 너무 큽니다')
  .int('금액은 정수여야 합니다');

/** 리치 텍스트 검증 */
export const richTextSchema = z
  .string()
  .max(100000, '내용이 너무 깁니다')
  .transform(text => sanitizeHtml(text));

/** 평문 텍스트 검증 */
export const plainTextSchema = z
  .string()
  .max(10000, '내용이 너무 깁니다')
  .transform(text => sanitizeString(text));

// ============================================
// File Upload Validation
// ============================================

// 허용된 이미지 MIME 타입
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
];

// 허용된 문서 MIME 타입
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// 허용된 비디오 MIME 타입
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

/** 이미지 파일 검증 */
export const imageFileSchema = z.object({
  name: z.string().max(255),
  type: z.enum(ALLOWED_IMAGE_TYPES as [string, ...string[]]),
  size: z.number().max(10 * 1024 * 1024, '이미지 크기는 10MB 이하여야 합니다'),
});

/** 문서 파일 검증 */
export const documentFileSchema = z.object({
  name: z.string().max(255),
  type: z.enum(ALLOWED_DOCUMENT_TYPES as [string, ...string[]]),
  size: z.number().max(50 * 1024 * 1024, '문서 크기는 50MB 이하여야 합니다'),
});

/** 비디오 파일 검증 */
export const videoFileSchema = z.object({
  name: z.string().max(255),
  type: z.enum(ALLOWED_VIDEO_TYPES as [string, ...string[]]),
  size: z.number().max(500 * 1024 * 1024, '비디오 크기는 500MB 이하여야 합니다'),
});

/**
 * 파일 확장자로 MIME 타입 검증
 */
export function validateFileExtension(filename: string, mimetype: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeExtMap: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
    'video/mp4': ['mp4'],
    'video/webm': ['webm'],
  };

  const allowedExts = mimeExtMap[mimetype];
  return allowedExts ? allowedExts.includes(ext || '') : false;
}

// ============================================
// Common Data
// ============================================

/** 일반적인 비밀번호 목록 (상위 1000개 중 일부) */
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
  'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
  'passw0rd', 'shadow', '123123', '654321', 'superman',
  'qazwsx', 'michael', 'football', 'password1', 'password123',
];

/** 예약된 사용자명 */
const RESERVED_USERNAMES = [
  'admin', 'administrator', 'root', 'system', 'support',
  'help', 'info', 'contact', 'api', 'www',
  'mail', 'email', 'ftp', 'cdn', 'static',
  'creatorcircle', 'creator', 'circle', 'official',
  'null', 'undefined', 'test', 'demo', 'example',
];

// ============================================
// Export All
// ============================================

export {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_VIDEO_TYPES,
  COMMON_PASSWORDS,
  RESERVED_USERNAMES,
};
