import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "CreatorCircle - 크리에이터 구독 커뮤니티 플랫폼",
    template: "%s | CreatorCircle",
  },
  description:
    "유료 커뮤니티, 뉴스레터, 디지털 상품을 하나의 플랫폼에서. 수수료 단 10%, 크리에이터 90% 수익.",
  keywords: [
    "크리에이터",
    "구독",
    "커뮤니티",
    "뉴스레터",
    "디지털 상품",
    "멤버십",
    "유료 콘텐츠",
  ],
  authors: [{ name: "CreatorCircle" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "CreatorCircle",
    title: "CreatorCircle - 크리에이터 구독 커뮤니티 플랫폼",
    description:
      "유료 커뮤니티, 뉴스레터, 디지털 상품을 하나의 플랫폼에서. 수수료 단 10%, 크리에이터 90% 수익.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CreatorCircle",
    description: "크리에이터 구독 커뮤니티 플랫폼",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
