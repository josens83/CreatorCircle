/**
 * Secure Token Management
 *
 * 이메일 인증, 비밀번호 재설정 등을 위한 토큰 시스템
 * - 암호학적으로 안전한 토큰 생성
 * - 토큰 해싱 (DB 저장 시)
 * - 만료 시간 관리
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// ============================================
// Types
// ============================================

export type TokenType =
  | 'EMAIL_VERIFICATION'
  | 'PASSWORD_RESET'
  | 'EMAIL_CHANGE'
  | 'ACCOUNT_DELETION'
  | 'TWO_FACTOR_SETUP'
  | 'API_KEY';

export interface TokenConfig {
  /** 토큰 길이 (bytes) */
  length: number;
  /** 만료 시간 (ms) */
  expiresIn: number;
}

export interface Token {
  /** 원본 토큰 (사용자에게 전달) */
  token: string;
  /** 해시된 토큰 (DB 저장) */
  hashedToken: string;
  /** 만료 시간 */
  expiresAt: Date;
}

// ============================================
// Token Configuration
// ============================================

const TOKEN_CONFIGS: Record<TokenType, TokenConfig> = {
  EMAIL_VERIFICATION: {
    length: 32,
    expiresIn: 24 * 60 * 60 * 1000, // 24시간
  },
  PASSWORD_RESET: {
    length: 32,
    expiresIn: 1 * 60 * 60 * 1000, // 1시간
  },
  EMAIL_CHANGE: {
    length: 32,
    expiresIn: 1 * 60 * 60 * 1000, // 1시간
  },
  ACCOUNT_DELETION: {
    length: 32,
    expiresIn: 24 * 60 * 60 * 1000, // 24시간
  },
  TWO_FACTOR_SETUP: {
    length: 16,
    expiresIn: 10 * 60 * 1000, // 10분
  },
  API_KEY: {
    length: 32,
    expiresIn: 365 * 24 * 60 * 60 * 1000, // 1년
  },
};

// ============================================
// Token Generation
// ============================================

/**
 * 암호학적으로 안전한 토큰 생성
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 토큰 해싱 (DB 저장용)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * 타입별 토큰 생성
 */
export function createToken(type: TokenType): Token {
  const config = TOKEN_CONFIGS[type];
  const token = generateSecureToken(config.length);

  return {
    token,
    hashedToken: hashToken(token),
    expiresAt: new Date(Date.now() + config.expiresIn),
  };
}

// ============================================
// Email Verification
// ============================================

export class EmailVerificationService {
  /**
   * 이메일 인증 토큰 생성 및 저장
   */
  async createVerificationToken(userId: string, email: string): Promise<string> {
    const { token, hashedToken, expiresAt } = createToken('EMAIL_VERIFICATION');

    // 기존 토큰 삭제
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: email,
      },
    });

    // 새 토큰 저장
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires: expiresAt,
      },
    });

    return token;
  }

  /**
   * 이메일 인증 확인
   */
  async verifyEmail(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    const hashedToken = hashToken(token);

    const verificationToken = await prisma.verificationToken.findFirst({
      where: { token: hashedToken },
    });

    if (!verificationToken) {
      return { success: false, error: '유효하지 않은 인증 링크입니다.' };
    }

    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: hashedToken
          }
        },
      });
      return { success: false, error: '인증 링크가 만료되었습니다.' };
    }

    // 사용자 이메일 인증 처리
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
    });

    if (!user) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: hashedToken
          }
        },
      }),
    ]);

    return { success: true, userId: user.id };
  }

  /**
   * 인증 이메일 재발송 가능 여부 확인
   */
  async canResendVerification(email: string): Promise<{ canResend: boolean; waitTime?: number }> {
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        expires: { gt: new Date() },
      },
      orderBy: { expires: 'desc' },
    });

    if (!recentToken) {
      return { canResend: true };
    }

    // 마지막 발송으로부터 1분 대기
    const tokenAge = Date.now() - (recentToken.expires.getTime() - 24 * 60 * 60 * 1000);
    const minWait = 60 * 1000; // 1분

    if (tokenAge < minWait) {
      return {
        canResend: false,
        waitTime: Math.ceil((minWait - tokenAge) / 1000),
      };
    }

    return { canResend: true };
  }
}

// ============================================
// Password Reset
// ============================================

export class PasswordResetService {
  /**
   * 비밀번호 재설정 토큰 생성
   */
  async createResetToken(email: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // 사용자가 없어도 같은 응답 (이메일 열거 공격 방지)
    if (!user) {
      return { success: true };
    }

    // Rate limiting: 시간당 3회
    const recentTokens = await prisma.verificationToken.count({
      where: {
        identifier: `password_reset:${email}`,
        expires: { gt: new Date() },
      },
    });

    if (recentTokens >= 3) {
      return { success: false, error: '비밀번호 재설정 요청이 너무 많습니다.' };
    }

    const { token, hashedToken, expiresAt } = createToken('PASSWORD_RESET');

    await prisma.verificationToken.create({
      data: {
        identifier: `password_reset:${email}`,
        token: hashedToken,
        expires: expiresAt,
      },
    });

    return { success: true, token };
  }

  /**
   * 비밀번호 재설정 토큰 검증
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
    const hashedToken = hashToken(token);

    const resetToken = await prisma.verificationToken.findFirst({
      where: {
        token: hashedToken,
        identifier: { startsWith: 'password_reset:' },
      },
    });

    if (!resetToken) {
      return { valid: false, error: '유효하지 않은 재설정 링크입니다.' };
    }

    if (resetToken.expires < new Date()) {
      return { valid: false, error: '재설정 링크가 만료되었습니다.' };
    }

    const email = resetToken.identifier.replace('password_reset:', '');
    return { valid: true, email };
  }

  /**
   * 비밀번호 재설정 완료
   */
  async resetPassword(
    token: string,
    newPasswordHash: string
  ): Promise<{ success: boolean; error?: string }> {
    const verification = await this.verifyResetToken(token);

    if (!verification.valid || !verification.email) {
      return { success: false, error: verification.error };
    }

    const hashedToken = hashToken(token);

    await prisma.$transaction([
      // 비밀번호 업데이트
      prisma.user.update({
        where: { email: verification.email },
        data: { password: newPasswordHash },
      }),
      // 토큰 삭제
      prisma.verificationToken.deleteMany({
        where: {
          identifier: `password_reset:${verification.email}`,
        },
      }),
      // 다른 모든 세션 무효화 (선택적)
      // prisma.session.deleteMany({
      //   where: { userId: user.id },
      // }),
    ]);

    return { success: true };
  }
}

// ============================================
// API Key Management
// ============================================

export class ApiKeyService {
  /**
   * API 키 생성
   */
  async createApiKey(userId: string, name: string): Promise<{ key: string; keyId: string }> {
    const { token, hashedToken, expiresAt } = createToken('API_KEY');

    // 접두사 추가 (식별 용이)
    const apiKey = `cc_${token}`;

    // DB에 저장 (별도 API 키 테이블 권장)
    // 여기서는 간단히 verificationToken 사용
    const saved = await prisma.verificationToken.create({
      data: {
        identifier: `api_key:${userId}:${name}`,
        token: hashToken(apiKey),
        expires: expiresAt,
      },
    });

    return {
      key: apiKey,
      keyId: saved.token.substring(0, 8), // 식별용 짧은 ID
    };
  }

  /**
   * API 키 검증
   */
  async validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string }> {
    if (!apiKey.startsWith('cc_')) {
      return { valid: false };
    }

    const hashedKey = hashToken(apiKey);

    const keyRecord = await prisma.verificationToken.findFirst({
      where: {
        token: hashedKey,
        identifier: { startsWith: 'api_key:' },
        expires: { gt: new Date() },
      },
    });

    if (!keyRecord) {
      return { valid: false };
    }

    const [, userId] = keyRecord.identifier.split(':');
    return { valid: true, userId };
  }

  /**
   * API 키 폐기
   */
  async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    const result = await prisma.verificationToken.deleteMany({
      where: {
        identifier: { startsWith: `api_key:${userId}:` },
        token: { startsWith: keyId },
      },
    });

    return result.count > 0;
  }
}

// ============================================
// Singleton Instances
// ============================================

export const emailVerification = new EmailVerificationService();
export const passwordReset = new PasswordResetService();
export const apiKey = new ApiKeyService();

// ============================================
// Utility Functions
// ============================================

/**
 * 토큰 형식 검증 (hex 문자열)
 */
export function isValidTokenFormat(token: string, expectedLength?: number): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // hex 문자열 검증
  if (!/^[a-f0-9]+$/.test(token)) {
    return false;
  }

  // 길이 검증 (hex는 byte의 2배)
  if (expectedLength && token.length !== expectedLength * 2) {
    return false;
  }

  return true;
}

/**
 * 시간 기반 OTP 생성 (2FA용)
 */
export function generateTOTP(secret: string, window: number = 0): string {
  const counter = Math.floor(Date.now() / 30000) + window;
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
  hmac.update(Buffer.from(counter.toString(16).padStart(16, '0'), 'hex'));
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const code = ((hash[offset] & 0x7f) << 24) |
               ((hash[offset + 1] & 0xff) << 16) |
               ((hash[offset + 2] & 0xff) << 8) |
               (hash[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

/**
 * TOTP 검증
 */
export function verifyTOTP(token: string, secret: string, windowSize: number = 1): boolean {
  for (let w = -windowSize; w <= windowSize; w++) {
    if (generateTOTP(secret, w) === token) {
      return true;
    }
  }
  return false;
}
