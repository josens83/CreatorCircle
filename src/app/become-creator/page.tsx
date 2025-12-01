"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Sparkles,
  Users,
  Mail,
  Package,
  Check,
  ArrowRight,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const categories = [
  { value: "TECH", label: "기술/개발" },
  { value: "BUSINESS", label: "비즈니스/창업" },
  { value: "FINANCE", label: "투자/재테크" },
  { value: "CAREER", label: "커리어/취업" },
  { value: "MARKETING", label: "마케팅/그로스" },
  { value: "DESIGN", label: "디자인/UX" },
  { value: "WRITING", label: "글쓰기/콘텐츠" },
  { value: "LIFESTYLE", label: "라이프스타일" },
  { value: "EDUCATION", label: "교육/학습" },
  { value: "ENTERTAINMENT", label: "엔터테인먼트" },
];

const benefits = [
  {
    title: "업계 최저 수수료",
    description: "단 10% 수수료로 90%의 수익을 가져가세요",
    icon: DollarSign,
  },
  {
    title: "올인원 플랫폼",
    description: "커뮤니티, 뉴스레터, 디지털 상품을 한 곳에서",
    icon: Package,
  },
  {
    title: "강력한 제휴 시스템",
    description: "60% 커미션으로 바이럴 성장을 이끄세요",
    icon: Users,
  },
  {
    title: "빠른 정산",
    description: "주 2회 정산으로 빠르게 수익을 받으세요",
    icon: TrendingUp,
  },
];

export default function BecomeCreatorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    creatorName: "",
    creatorUsername: "",
    bio: "",
    circleName: "",
    category: "",
    tagline: "",
    monthlyPrice: "15000",
  });

  const handleSubmit = async () => {
    if (!session?.user) {
      router.push("/login?callbackUrl=/become-creator");
      return;
    }

    setIsLoading(true);

    try {
      // 1. 크리에이터 프로필 생성
      const creatorResponse = await fetch("/api/creators/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.creatorName,
          username: formData.creatorUsername,
          bio: formData.bio,
        }),
      });

      if (!creatorResponse.ok) {
        const error = await creatorResponse.json();
        alert(error.error);
        return;
      }

      // 2. 서클 생성
      const circleResponse = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.circleName,
          tagline: formData.tagline,
          category: formData.category,
          pricing: {
            hasFreeTier: true,
            monthlyPrice: parseInt(formData.monthlyPrice),
          },
        }),
      });

      if (!circleResponse.ok) {
        const error = await circleResponse.json();
        alert(error.error);
        return;
      }

      // 성공 시 대시보드로 이동
      router.push("/creator/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Error:", error);
      alert("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold mb-6">
                크리에이터가 되어
                <br />
                <span className="gradient-text">수익을 창출하세요</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                유료 커뮤니티, 뉴스레터, 디지털 상품으로 수익화하세요.
                <br />
                수수료 단 10%, 크리에이터 90% 수익.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-12 border-y bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-6">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="text-center">
                  <div className="flex justify-center mb-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <benefit.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              {!session ? (
                <Card>
                  <CardHeader className="text-center">
                    <CardTitle>시작하기</CardTitle>
                    <CardDescription>
                      크리에이터가 되려면 먼저 로그인해주세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    <Button size="lg" asChild>
                      <Link href="/login?callbackUrl=/become-creator">
                        로그인하기
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      계정이 없으신가요?{" "}
                      <Link href="/signup" className="text-primary hover:underline">
                        회원가입
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-2">
                        {[1, 2, 3].map((s) => (
                          <div
                            key={s}
                            className={`h-2 w-12 rounded-full ${
                              s <= step ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {step}/3 단계
                      </span>
                    </div>
                    <CardTitle>
                      {step === 1 && "크리에이터 프로필"}
                      {step === 2 && "서클 정보"}
                      {step === 3 && "가격 설정"}
                    </CardTitle>
                    <CardDescription>
                      {step === 1 && "크리에이터로 활동할 프로필을 설정하세요"}
                      {step === 2 && "첫 번째 서클을 만들어보세요"}
                      {step === 3 && "멤버십 가격을 설정하세요"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {step === 1 && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="creatorName">크리에이터 이름</Label>
                          <Input
                            id="creatorName"
                            value={formData.creatorName}
                            onChange={(e) =>
                              setFormData({ ...formData, creatorName: e.target.value })
                            }
                            placeholder="홍길동"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="creatorUsername">사용자명</Label>
                          <Input
                            id="creatorUsername"
                            value={formData.creatorUsername}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                creatorUsername: e.target.value,
                              })
                            }
                            placeholder="username"
                          />
                          <p className="text-xs text-muted-foreground">
                            영문, 숫자, 밑줄(_)만 사용 가능. URL: creatorcircle.co/@{formData.creatorUsername || "username"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bio">소개</Label>
                          <Textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e) =>
                              setFormData({ ...formData, bio: e.target.value })
                            }
                            placeholder="당신에 대해 간단히 소개해주세요"
                            rows={3}
                          />
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="circleName">서클 이름</Label>
                          <Input
                            id="circleName"
                            value={formData.circleName}
                            onChange={(e) =>
                              setFormData({ ...formData, circleName: e.target.value })
                            }
                            placeholder="예: 스타트업 인사이트"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">카테고리</Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) =>
                              setFormData({ ...formData, category: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="카테고리 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tagline">한 줄 소개</Label>
                          <Input
                            id="tagline"
                            value={formData.tagline}
                            onChange={(e) =>
                              setFormData({ ...formData, tagline: e.target.value })
                            }
                            placeholder="서클을 한 줄로 소개해주세요"
                          />
                        </div>
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="monthlyPrice">월간 구독 가격 (원)</Label>
                          <Input
                            id="monthlyPrice"
                            type="number"
                            value={formData.monthlyPrice}
                            onChange={(e) =>
                              setFormData({ ...formData, monthlyPrice: e.target.value })
                            }
                            placeholder="15000"
                          />
                          <p className="text-xs text-muted-foreground">
                            권장 가격: ₩9,900 ~ ₩49,000
                          </p>
                        </div>

                        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                          <h4 className="font-medium">수익 시뮬레이션</h4>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">구독자 100명 기준</span>
                              <span>₩{(parseInt(formData.monthlyPrice || "0") * 100).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>플랫폼 수수료 (10%)</span>
                              <span>-₩{(parseInt(formData.monthlyPrice || "0") * 10).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-green-600 pt-2 border-t">
                              <span>예상 월 수익</span>
                              <span>₩{(parseInt(formData.monthlyPrice || "0") * 90).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>무료 티어 자동 생성</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>언제든 가격 변경 가능</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Stripe 연동으로 안전한 결제</span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex gap-3 pt-4">
                      {step > 1 && (
                        <Button
                          variant="outline"
                          onClick={() => setStep(step - 1)}
                          className="flex-1"
                        >
                          이전
                        </Button>
                      )}
                      {step < 3 ? (
                        <Button onClick={() => setStep(step + 1)} className="flex-1">
                          다음
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSubmit}
                          isLoading={isLoading}
                          className="flex-1"
                        >
                          크리에이터 시작하기
                          <Sparkles className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
