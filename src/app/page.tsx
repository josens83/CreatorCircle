import Link from "next/link";
import {
  Sparkles,
  Users,
  CreditCard,
  FileText,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Star,
  Mail,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const stats = [
  { label: "크리에이터", value: "1,234", icon: Users },
  { label: "총 정산액", value: "₩12.5억", icon: CreditCard },
  { label: "포스트", value: "45,678", icon: FileText },
  { label: "구독자", value: "89,012", icon: TrendingUp },
];

const features = [
  {
    title: "유료 커뮤니티",
    description: "멤버십 티어로 프리미엄 콘텐츠를 제공하세요",
    icon: Users,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "뉴스레터",
    description: "이메일로 구독자에게 직접 전달하세요",
    icon: Mail,
    color: "from-purple-500 to-pink-500",
  },
  {
    title: "디지털 상품",
    description: "이북, 템플릿, 강의를 판매하세요",
    icon: Package,
    color: "from-orange-500 to-red-500",
  },
];

const benefits = [
  "업계 최저 수수료 10%",
  "크리에이터 90% 수익 보장",
  "주 2회 빠른 정산",
  "강력한 제휴 커미션 시스템",
  "올인원 플랫폼 (커뮤니티+뉴스레터+상품)",
  "한국 시장 특화 결제 시스템",
];

const popularCircles = [
  {
    name: "스타트업 인사이트",
    creator: "김창업",
    members: 1234,
    price: 15000,
    category: "비즈니스",
    rating: 4.9,
  },
  {
    name: "개발자 커뮤니티",
    creator: "박개발",
    members: 2341,
    price: 9900,
    category: "기술",
    rating: 4.8,
  },
  {
    name: "마케팅 연구소",
    creator: "이마케터",
    members: 892,
    price: 29000,
    category: "마케팅",
    rating: 4.9,
  },
  {
    name: "투자 클럽",
    creator: "최투자",
    members: 567,
    price: 49000,
    category: "재테크",
    rating: 4.7,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 md:py-32">
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <div className="container mx-auto px-4 relative">
            <div className="max-w-4xl mx-auto text-center">
              <Badge variant="secondary" className="mb-6">
                <Sparkles className="h-3 w-3 mr-1" />
                크리에이터 이코노미의 새로운 시작
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                당신의 지식을{" "}
                <span className="gradient-text">수익으로</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                유료 커뮤니티, 뉴스레터, 디지털 상품을 하나의 플랫폼에서.
                <br />
                <strong className="text-foreground">수수료 단 10%</strong>로 시작하세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="xl" variant="gradient" asChild>
                  <Link href="/signup">
                    무료로 시작하기
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
                <Button size="xl" variant="outline" asChild>
                  <Link href="/explore">서클 탐색하기</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 border-y bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="flex justify-center mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <stat.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">모든 것을 하나의 플랫폼에서</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                커뮤니티, 뉴스레터, 디지털 상품 판매까지. 크리에이터에게 필요한 모든 도구를 제공합니다.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Popular Circles Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-3xl font-bold mb-2">인기 서클</h2>
                <p className="text-muted-foreground">가장 활발한 크리에이터 커뮤니티를 만나보세요</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/explore">
                  전체 보기
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {popularCircles.map((circle) => (
                <Card key={circle.name} className="group hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl font-bold text-white mb-3">
                      {circle.name[0]}
                    </div>
                    <Badge variant="outline" className="w-fit mb-2">
                      {circle.category}
                    </Badge>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {circle.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">by {circle.creator}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{circle.members.toLocaleString()}명</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span>{circle.rating}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <span className="text-lg font-bold">₩{circle.price.toLocaleString()}</span>
                      <span className="text-muted-foreground">/월</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">
                  왜 <span className="text-primary">CreatorCircle</span>인가요?
                </h2>
                <p className="text-muted-foreground mb-8">
                  크리에이터를 위해 설계된 플랫폼입니다. 업계 최저 수수료와 강력한 도구로 수익화에 집중하세요.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl p-8">
                  <Card className="shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">수익 시뮬레이션</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">월 구독자 100명</span>
                        <span className="font-semibold">₩29,000/월 기준</span>
                      </div>
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span>총 매출</span>
                          <span className="font-semibold">₩2,900,000</span>
                        </div>
                        <div className="flex justify-between items-center mb-2 text-muted-foreground">
                          <span>플랫폼 수수료 (10%)</span>
                          <span>-₩290,000</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t text-lg font-bold text-green-600">
                          <span>크리에이터 수익</span>
                          <span>₩2,610,000</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-primary to-secondary text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              지금 바로 시작하세요
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              무료로 서클을 만들고, 당신만의 커뮤니티를 시작하세요.
              <br />
              결제가 발생할 때만 수수료가 부과됩니다.
            </p>
            <Button size="xl" variant="secondary" asChild>
              <Link href="/become-creator">
                크리에이터로 시작하기
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
