import Link from "next/link";
import {
  Users,
  Star,
  FileText,
  Share2,
  MoreHorizontal,
  Check,
  Lock,
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/avatar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// Mock data - 실제로는 서버에서 가져옴
const circle = {
  id: "1",
  name: "스타트업 인사이트",
  slug: "startup-insights",
  tagline: "실리콘밸리 10년 경험의 스타트업 성장 전략",
  description: `실리콘밸리에서 10년간 스타트업을 운영하며 얻은 성장 전략과 투자 인사이트를 공유합니다.

매주 심층 분석 리포트와 실전 케이스 스터디를 제공하며, 월 1회 라이브 Q&A 세션을 진행합니다.

**제공하는 가치:**
- 주간 스타트업 트렌드 분석
- 투자 유치 전략 가이드
- 성장 해킹 케이스 스터디
- 멤버 전용 네트워킹`,
  coverImage: null,
  category: "비즈니스",
  tags: ["스타트업", "투자", "성장전략", "창업"],
  creator: {
    id: "1",
    name: "김창업",
    username: "startup_kim",
    avatar: null,
    bio: "스타트업 창업가 & 엔젤 투자자",
    verified: true,
  },
  stats: {
    memberCount: 1234,
    postCount: 156,
    rating: 4.9,
    reviewCount: 89,
  },
  pricing: {
    hasFreeTier: true,
    monthlyPrice: 15000,
    yearlyPrice: 150000,
    yearlyDiscount: 17,
  },
  tiers: [
    {
      id: "free",
      name: "무료 멤버",
      price: 0,
      benefits: ["주간 뉴스레터", "무료 콘텐츠 열람", "커뮤니티 참여"],
      popular: false,
    },
    {
      id: "basic",
      name: "베이직",
      price: 15000,
      yearlyPrice: 150000,
      benefits: [
        "모든 무료 혜택",
        "주간 인사이트 리포트",
        "월간 Q&A 세션",
        "아카이브 전체 열람",
      ],
      popular: true,
    },
    {
      id: "premium",
      name: "프리미엄",
      price: 29000,
      yearlyPrice: 290000,
      benefits: [
        "모든 베이직 혜택",
        "1:1 피드백 (월 1회)",
        "오프라인 네트워킹",
        "비공개 슬랙 채널",
        "멤버 전용 자료",
      ],
      popular: false,
    },
  ],
};

const posts = [
  {
    id: "1",
    title: "2024년 스타트업 투자 트렌드 분석",
    excerpt: "올해 VC들이 주목하는 5가지 섹터와 투자 전략을 분석합니다...",
    accessType: "paid",
    publishedAt: "12시간 전",
    viewCount: 1234,
    likeCount: 56,
    commentCount: 12,
    isPinned: true,
  },
  {
    id: "2",
    title: "시리즈 A 투자 유치 완벽 가이드",
    excerpt: "투자 유치 준비부터 협상까지, 창업가가 알아야 할 모든 것...",
    accessType: "paid",
    publishedAt: "2일 전",
    viewCount: 890,
    likeCount: 34,
    commentCount: 8,
    isPinned: false,
  },
  {
    id: "3",
    title: "스타트업 성장 해킹 케이스 스터디 #15",
    excerpt: "월 성장률 30%를 달성한 SaaS 스타트업의 그로스 전략...",
    accessType: "paid",
    publishedAt: "5일 전",
    viewCount: 756,
    likeCount: 28,
    commentCount: 6,
    isPinned: false,
  },
  {
    id: "4",
    title: "[무료] 창업자가 알아야 할 법률 기초",
    excerpt: "주식회사 설립, 스톡옵션, 투자 계약서 체크리스트...",
    accessType: "free",
    publishedAt: "1주 전",
    viewCount: 2345,
    likeCount: 89,
    commentCount: 23,
    isPinned: false,
  },
];

export default function CirclePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-muted/30">
        {/* Cover */}
        <div className="h-48 md:h-64 bg-gradient-to-r from-primary to-secondary" />

        <div className="container mx-auto px-4">
          {/* Profile Section */}
          <div className="relative -mt-16 mb-8">
            <div className="bg-background rounded-lg shadow-lg p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-4xl md:text-5xl font-bold text-white border-4 border-background shadow-lg -mt-16 md:-mt-20">
                    {circle.name[0]}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{circle.category}</Badge>
                        {circle.creator.verified && (
                          <Badge variant="success">
                            <Check className="h-3 w-3 mr-1" />
                            인증됨
                          </Badge>
                        )}
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold mb-2">{circle.name}</h1>
                      <p className="text-muted-foreground mb-4">{circle.tagline}</p>

                      {/* Creator Info */}
                      <Link
                        href={`/@${circle.creator.username}`}
                        className="inline-flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -ml-2 transition-colors"
                      >
                        <UserAvatar
                          name={circle.creator.name}
                          avatar={circle.creator.avatar}
                          size="md"
                        />
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {circle.creator.name}
                            {circle.creator.verified && (
                              <span className="text-primary">✓</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{circle.creator.username}
                          </div>
                        </div>
                      </Link>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 mt-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{circle.stats.memberCount.toLocaleString()}</span>
                      <span className="text-muted-foreground">멤버</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{circle.stats.postCount}</span>
                      <span className="text-muted-foreground">포스트</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span className="font-semibold">{circle.stats.rating}</span>
                      <span className="text-muted-foreground">({circle.stats.reviewCount})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-8 pb-12">
            {/* Left Column - Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* About */}
              <Card>
                <CardHeader>
                  <CardTitle>소개</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none whitespace-pre-line">
                    {circle.description}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t">
                    {circle.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Posts */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>포스트</CardTitle>
                    <Tabs defaultValue="all">
                      <TabsList className="h-9">
                        <TabsTrigger value="all" className="text-xs">전체</TabsTrigger>
                        <TabsTrigger value="free" className="text-xs">무료</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {posts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/circle/${circle.slug}/posts/${post.id}`}
                        className="block p-4 md:p-6 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {post.accessType === "paid" ? (
                            <Lock className="h-4 w-4 text-amber-500 mt-1 flex-shrink-0" />
                          ) : (
                            <ExternalLink className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {post.isPinned && (
                                <Badge variant="secondary" className="text-xs">
                                  고정
                                </Badge>
                              )}
                              {post.accessType === "paid" && (
                                <Badge variant="premium" className="text-xs">
                                  유료
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold mb-1 line-clamp-1">{post.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {post.excerpt}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{post.publishedAt}</span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {post.viewCount.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {post.likeCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                {post.commentCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Pricing */}
            <div className="space-y-6">
              {/* Membership Tiers */}
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>멤버십 가입</CardTitle>
                  <CardDescription>
                    연간 결제 시 최대 {circle.pricing.yearlyDiscount}% 할인
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {circle.tiers.map((tier) => (
                    <div
                      key={tier.id}
                      className={`relative rounded-lg border p-4 ${
                        tier.popular ? "border-primary ring-2 ring-primary" : ""
                      }`}
                    >
                      {tier.popular && (
                        <Badge className="absolute -top-2 left-4">인기</Badge>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{tier.name}</h3>
                        <div>
                          {tier.price === 0 ? (
                            <span className="text-lg font-bold">무료</span>
                          ) : (
                            <>
                              <span className="text-lg font-bold">
                                ₩{tier.price.toLocaleString()}
                              </span>
                              <span className="text-muted-foreground">/월</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-2 mb-4">
                        {tier.benefits.map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full"
                        variant={tier.popular ? "default" : "outline"}
                      >
                        {tier.price === 0 ? "무료로 시작" : "가입하기"}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
