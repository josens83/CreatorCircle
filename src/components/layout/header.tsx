"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import {
  Menu,
  X,
  Search,
  Bell,
  Plus,
  ChevronDown,
  User,
  Settings,
  LogOut,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="hidden font-bold text-xl sm:inline-block">
              Creator<span className="text-primary">Circle</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/explore"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              탐색
            </Link>
            <Link
              href="/categories"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              카테고리
            </Link>
            {session?.user.role === "CREATOR" && (
              <Link
                href="/creator/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                대시보드
              </Link>
            )}
          </nav>

          {/* Search (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="서클 또는 크리에이터 검색..."
                className="pl-10 bg-muted/50"
              />
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {status === "loading" ? (
              <div className="h-10 w-24 skeleton rounded-md" />
            ) : session ? (
              <>
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                    3
                  </span>
                </Button>

                {/* Create Button */}
                {session.user.role === "CREATOR" && (
                  <Button size="sm" className="hidden sm:flex">
                    <Plus className="h-4 w-4 mr-2" />새 포스트
                  </Button>
                )}

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2 p-1.5">
                      <UserAvatar
                        name={session.user.name}
                        avatar={session.user.avatar}
                        size="sm"
                      />
                      <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span>{session.user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          @{session.user.username}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="h-4 w-4 mr-2" />
                        프로필
                      </Link>
                    </DropdownMenuItem>
                    {session.user.role === "CREATOR" ? (
                      <DropdownMenuItem asChild>
                        <Link href="/creator/dashboard">
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          크리에이터 대시보드
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link href="/become-creator">
                          <Sparkles className="h-4 w-4 mr-2" />
                          크리에이터 되기
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings className="h-4 w-4 mr-2" />
                        설정
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:flex">
                  <Link href="/login">로그인</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">무료로 시작하기</Link>
                </Button>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="검색..."
                className="pl-10"
              />
            </div>
            <nav className="flex flex-col space-y-2">
              <Link
                href="/explore"
                className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                탐색
              </Link>
              <Link
                href="/categories"
                className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                카테고리
              </Link>
              {session?.user.role === "CREATOR" && (
                <Link
                  href="/creator/dashboard"
                  className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  크리에이터 대시보드
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
