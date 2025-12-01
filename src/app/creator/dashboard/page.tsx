import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Eye,
  Mail,
  ArrowUpRight,
  MoreHorizontal,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const stats = [
  {
    title: "이번 달 수익",
    value: "₩2,456,000",
    change: "+23%",
    trend: "up",
    icon: DollarSign,
  },
  {
    title: "총 멤버",
    value: "1,234",
    change: "+45",
    trend: "up",
    icon: Users,
  },
  {
    title: "조회수",
    value: "8,234",
    change: "-12%",
    trend: "down",
    icon: Eye,
  },
  {
    title: "이메일 오픈율",
    value: "68%",
    change: "+5%",
    trend: "up",
    icon: Mail,
  },
];

const recentPosts = [
  {
    id: "1",
    title: "2024년 스타트업 투자 트렌드 분석",
    views: 1234,
    likes: 56,
    status: "published",
    publishedAt: "12시간 전",
  },
  {
    id: "2",
    title: "시리즈 A 투자 유치 완벽 가이드",
    views: 890,
    likes: 34,
    status: "published",
    publishedAt: "2일 전",
  },
  {
    id: "3",
    title: "스타트업 성장 해킹 케이스 스터디 #15",
    views: 756,
    likes: 28,
    status: "draft",
    publishedAt: null,
  },
];

const recentMembers = [
  { id: "1", name: "김철수", email: "kim@example.com", tier: "프리미엄", joinedAt: "2시간 전" },
  { id: "2", name: "이영희", email: "lee@example.com", tier: "베이직", joinedAt: "5시간 전" },
  { id: "3", name: "박민수", email: "park@example.com", tier: "베이직", joinedAt: "1일 전" },
  { id: "4", name: "정수진", email: "jung@example.com", tier: "무료", joinedAt: "2일 전" },
];

const upcomingPayouts = [
  {
    amount: 1890000,
    date: "12월 15일",
    status: "scheduled",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">안녕하세요, 김창업님!</h1>
        <p className="text-muted-foreground">
          오늘의 서클 현황을 확인하세요.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center text-xs mt-1">
                {stat.trend === "up" ? (
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span
                  className={stat.trend === "up" ? "text-green-500" : "text-red-500"}
                >
                  {stat.change}
                </span>
                <span className="text-muted-foreground ml-1">전월 대비</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Posts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>최근 포스트</CardTitle>
              <CardDescription>최근 작성한 포스트 성과</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/creator/posts">
                전체 보기
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{post.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {post.status === "published" ? (
                          <>
                            <span>👁️ {post.views}</span>
                            <span>❤️ {post.likes}</span>
                            <span>{post.publishedAt}</span>
                          </>
                        ) : (
                          <Badge variant="secondary">임시저장</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>최근 가입 멤버</CardTitle>
              <CardDescription>새로 가입한 멤버</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/creator/members">
                전체 보기
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium flex-shrink-0">
                      {member.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge
                      variant={
                        member.tier === "프리미엄"
                          ? "premium"
                          : member.tier === "베이직"
                          ? "basic"
                          : "secondary"
                      }
                    >
                      {member.tier}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {member.joinedAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payout */}
        <Card>
          <CardHeader>
            <CardTitle>다음 정산</CardTitle>
            <CardDescription>예정된 정산 금액</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingPayouts.map((payout, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              >
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    ₩{payout.amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    수수료 10% 차감 후 금액
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="success">{payout.date} 예정</Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link href="/creator/payouts">정산 내역 보기</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>빠른 작업</CardTitle>
            <CardDescription>자주 사용하는 기능</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/creator/posts/new">
                  <FileText className="h-5 w-5" />
                  <span>새 포스트</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/creator/newsletter">
                  <Mail className="h-5 w-5" />
                  <span>뉴스레터 발송</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/creator/members">
                  <Users className="h-5 w-5" />
                  <span>멤버 관리</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/creator/settings">
                  <DollarSign className="h-5 w-5" />
                  <span>가격 설정</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
