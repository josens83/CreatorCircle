'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================
// Types
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 커스텀 폴백 UI */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  /** 에러 발생 시 콜백 */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** 재시도 가능 여부 */
  canRetry?: boolean;
  /** 에러 바운더리 이름 (로깅용) */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

// ============================================
// Error Boundary Component
// ============================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 에러 정보 저장
    this.setState({ errorInfo });

    // 콜백 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 로깅
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`,
      error,
      errorInfo.componentStack
    );

    // TODO: Sentry 등 에러 추적 서비스로 전송
    // captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // 커스텀 폴백이 함수인 경우
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // 커스텀 폴백이 ReactNode인 경우
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.props.canRetry !== false ? this.resetError : undefined}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================
// Default Error Fallback UI
// ============================================

interface DefaultErrorFallbackProps {
  error: Error;
  onRetry?: () => void;
}

function DefaultErrorFallback({ error, onRetry }: DefaultErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            문제가 발생했습니다
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            페이지를 표시하는 중 오류가 발생했습니다.
            잠시 후 다시 시도해 주세요.
          </p>
          {isDev && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                에러 상세 정보 (개발 모드)
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </CardContent>
        {onRetry && (
          <CardFooter>
            <Button onClick={onRetry} className="w-full">
              다시 시도
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

// ============================================
// Specialized Error Boundaries
// ============================================

/**
 * 페이지 레벨 에러 바운더리
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      name="Page"
      fallback={(error, resetError) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="text-center">
                페이지를 불러올 수 없습니다
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">
                일시적인 문제가 발생했습니다.
                <br />
                잠시 후 다시 시도하거나 홈으로 이동해 주세요.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={resetError}>
                  다시 시도
                </Button>
                <Button onClick={() => window.location.href = '/'}>
                  홈으로 이동
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 섹션 레벨 에러 바운더리 (부분 실패 허용)
 */
export function SectionErrorBoundary({
  children,
  fallbackMessage = '이 섹션을 불러올 수 없습니다',
}: {
  children: ReactNode;
  fallbackMessage?: string;
}) {
  return (
    <ErrorBoundary
      name="Section"
      fallback={
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
          <p>{fallbackMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            페이지 새로고침
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 위젯 레벨 에러 바운더리 (조용한 실패)
 */
export function WidgetErrorBoundary({
  children,
  showError = false,
}: {
  children: ReactNode;
  showError?: boolean;
}) {
  return (
    <ErrorBoundary
      name="Widget"
      fallback={
        showError ? (
          <div className="p-2 text-xs text-gray-400 text-center">
            로드 실패
          </div>
        ) : null
      }
      onError={(error) => {
        // 위젯 에러는 조용히 로깅만
        console.warn('[WidgetError]', error.message);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================
// Error Boundary Hook (for async errors)
// ============================================

import { useState, useCallback } from 'react';

/**
 * 비동기 에러를 ErrorBoundary로 전파하기 위한 훅
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const throwError = useErrorBoundary();
 *
 *   useEffect(() => {
 *     fetchData().catch(throwError);
 *   }, []);
 * }
 * ```
 */
export function useErrorBoundary() {
  const [, setError] = useState<Error>();

  return useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}

// ============================================
// Error Fallback Components
// ============================================

/**
 * 네트워크 에러용 폴백
 */
export function NetworkErrorFallback({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-gray-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        연결할 수 없습니다
      </h3>
      <p className="text-gray-500 mb-4">
        인터넷 연결을 확인하고 다시 시도해 주세요.
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          다시 시도
        </Button>
      )}
    </div>
  );
}

/**
 * 인증 에러용 폴백
 */
export function AuthErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-gray-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        로그인이 필요합니다
      </h3>
      <p className="text-gray-500 mb-4">
        이 콘텐츠를 보려면 로그인해 주세요.
      </p>
      <Button onClick={() => window.location.href = '/login'}>
        로그인하기
      </Button>
    </div>
  );
}

/**
 * 권한 에러용 폴백
 */
export function PermissionErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-gray-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        접근 권한이 없습니다
      </h3>
      <p className="text-gray-500 mb-4">
        이 콘텐츠에 접근할 권한이 없습니다.
      </p>
      <Button variant="outline" onClick={() => window.history.back()}>
        이전 페이지로
      </Button>
    </div>
  );
}
