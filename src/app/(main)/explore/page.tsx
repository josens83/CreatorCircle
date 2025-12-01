import Link from "next/link";
import { Search, Filter, Users, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const categories = [
  { id: "all", name: "전체", count: 1234 },
  { id: "tech", name: "기술/개발", count: 234 },
  { id: "business", name: "비즈니스", count: 189 },
  { id: "finance", name: "투자/재테크", count: 156 },
  { id: "marketing", name: "마케팅", count: 143 },
  { id: "design", name: "디자인", count: 98 },
  { id: "writing", name: "글쓰기", count: 87 },
  { id: "career", name: "커리어", count: 76 },
  { id: "lifestyle", name: "라이프스타일", count: 65 },
  { id: "education", name: "교육", count: 54 },
];

const circles = [
  {
    id: "1",
    name: "스타트업 인사이트",
    slug: "startup-insights",
    creator: { name: "김창업", username: "startup_kim", verified: true },
    description: "실리콘밸리 10년 경험을 바탕으로 한 스타트업 성장 전략과 투자 인사이트를 공유합니다.",
    category: "비즈니스",
    memberCount: 1234,
    postCount: 156,
    rating: 4.9,
    price: 15000,
    hasFreeTier: true,
    tags: ["스타트업", "투자", "성장전략"],
  },
  {
    id: "2",
    name: "풀스택 개발자 모임",
    slug: "fullstack-dev",
    creator: { name: "박개발", username: "dev_park", verified: true },
    description: "React, Node.js, TypeScript 등 풀스택 개발 노하우와 실전 프로젝트 경험을 공유하는 커뮤니티입니다.",
    category: "기술",
    memberCount: 2341,
    postCount: 289,
    rating: 4.8,
    price: 9900,
    hasFreeTier: true,
    tags: ["React", "Node.js", "TypeScript"],
  },
  {
    id: "3",
    name: "마케팅 연구소",
    slug: "marketing-lab",
    creator: { name: "이마케터", username: "marketer_lee", verified: true },
    description: "퍼포먼스 마케팅부터 브랜딩까지, 실무에서 바로 적용할 수 있는 마케팅 전략을 공유합니다.",
    category: "마케팅",
    memberCount: 892,
    postCount: 178,
    rating: 4.9,
    price: 29000,
    hasFreeTier: false,
    tags: ["퍼포먼스마케팅", "그로스", "브랜딩"],
  },
  {
    id: "4",
    name: "투자 클럽",
    slug: "invest-club",
    creator: { name: "최투자", username: "invest_choi", verified: true },
    description: "주식, 부동산, 가상자산까지 다양한 투자 인사이트를 공유하는 프리미엄 투자 커뮤니티입니다.",
    category: "투자",
    memberCount: 567,
    postCount: 234,
    rating: 4.7,
    price: 49000,
    hasFreeTier: false,
    tags: ["주식", "부동산", "투자"],
  },
  {
    id: "5",
    name: "디자인 스튜디오",
    slug: "design-studio",
    creator: { name: "강디자인", username: "design_kang", verified: false },
    description: "UI/UX 디자인, 피그마 실전 활용법, 포트폴리오 제작 노하우를 공유합니다.",
    category: "디자인",
    memberCount: 456,
    postCount: 123,
    rating: 4.8,
    price: 19000,
    hasFreeTier: true,
    tags: ["UI/UX", "Figma", "포트폴리오"],
  },
  {
    id: "6",
    name: "글쓰기 워크숍",
    slug: "writing-workshop",
    creator: { name: "윤작가", username: "writer_yoon", verified: true },
    description: "브런치 인기 작가가 알려주는 매력적인 글쓰기 비법과 콘텐츠 제작 노하우.",
    category: "글쓰기",
    memberCount: 789,
    postCount: 167,
    rating: 4.9,
    price: 15000,
    hasFreeTier: true,
    tags: ["글쓰기", "브런치", "콘텐츠"],
  },
];

export default function ExplorePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-muted/30">
        {/* Hero Section */}
        <section className="bg-background border-b py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-8">
              <h1 className="text-3xl font-bold mb-4">서클 탐색</h1>
              <p className="text-muted-foreground">
                관심 분야의 크리에이터를 찾고 프리미엄 콘텐츠를 경험하세요
              </p>
            </div>
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="서클 또는 크리에이터 검색..."
                  className="pl-12 h-12 text-base"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="border-b bg-background">
          <div className="container mx-auto px-4">
            <div className="flex overflow-x-auto no-scrollbar py-4 gap-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={category.id === "all" ? "default" : "outline"}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  {category.name}
                  <span className="ml-1 text-xs opacity-70">({category.count})</span>
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Circles Grid */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <Tabs defaultValue="trending">
                <TabsList>
                  <TabsTrigger value="trending">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    인기
                  </TabsTrigger>
                  <TabsTrigger value="newest">최신</TabsTrigger>
                  <TabsTrigger value="members">멤버 수</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                필터
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {circles.map((circle) => (
                <Link key={circle.id} href={`/circle/${circle.slug}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                          {circle.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {circle.category}
                            </Badge>
                            {circle.hasFreeTier && (
                              <Badge variant="secondary" className="text-xs">
                                무료 체험
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                            {circle.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            by @{circle.creator.username}
                            {circle.creator.verified && (
                              <span className="text-primary ml-1">✓</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {circle.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-4">
                        {circle.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {circle.memberCount.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            {circle.rating}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold">₩{circle.price.toLocaleString()}</span>
                          <span className="text-muted-foreground text-sm">/월</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Load More */}
            <div className="flex justify-center mt-12">
              <Button variant="outline" size="lg">
                더 보기
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
