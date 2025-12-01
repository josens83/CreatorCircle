"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Mail,
  Package,
  Link2,
  CreditCard,
  Settings,
  ChevronDown,
  Plus,
  Sparkles,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const sidebarItems = [
  {
    title: "대시보드",
    href: "/creator/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "포스트",
    href: "/creator/posts",
    icon: FileText,
  },
  {
    title: "멤버",
    href: "/creator/members",
    icon: Users,
  },
  {
    title: "뉴스레터",
    href: "/creator/newsletter",
    icon: Mail,
  },
  {
    title: "상품",
    href: "/creator/products",
    icon: Package,
  },
  {
    title: "제휴",
    href: "/creator/affiliate",
    icon: Link2,
  },
  {
    title: "정산",
    href: "/creator/payouts",
    icon: CreditCard,
  },
  {
    title: "설정",
    href: "/creator/settings",
    icon: Settings,
  },
];

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top Header */}
      <header className="sticky top-0 z-50 h-16 border-b bg-background">
        <div className="flex h-full items-center justify-between px-4">
          {/* Left */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="hidden font-bold text-lg md:block">
                Creator<span className="text-primary">Circle</span>
              </span>
            </Link>

            <div className="h-6 w-px bg-border" />

            {/* Circle Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">
                    S
                  </div>
                  <span className="hidden sm:block">스타트업 인사이트</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">
                      S
                    </div>
                    <span>스타트업 인사이트</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Plus className="h-4 w-4 mr-2" />
                  새 서클 만들기
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              새 포스트
            </Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-1.5">
                  <UserAvatar name="김창업" size="sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/circle/startup-insights">내 서클 보기</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/">홈으로</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-64 border-r bg-background md:block">
          <nav className="flex flex-col gap-1 p-4">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background md:hidden">
          {sidebarItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs">{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main Content */}
        <main className="flex-1 md:ml-64">
          <div className="container mx-auto p-4 md:p-8 pb-24 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
