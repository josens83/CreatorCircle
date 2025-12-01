import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// GET /api/circles/[slug] - 서클 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const circle = await prisma.circle.findUnique({
      where: { slug },
      include: {
        creator: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        tiers: {
          orderBy: { sortOrder: "asc" },
        },
        affiliateProgram: true,
        _count: {
          select: {
            posts: { where: { status: "PUBLISHED" } },
            members: { where: { status: "ACTIVE" } },
          },
        },
      },
    });

    if (!circle) {
      return NextResponse.json({ error: "서클을 찾을 수 없습니다" }, { status: 404 });
    }

    // 현재 사용자의 멤버십 확인
    const session = await getServerSession(authOptions);
    let membership = null;

    if (session?.user) {
      membership = await prisma.member.findUnique({
        where: {
          userId_circleId: {
            userId: session.user.id,
            circleId: circle.id,
          },
        },
        include: {
          tier: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            take: 1,
          },
        },
      });
    }

    return NextResponse.json({
      circle,
      membership,
    });
  } catch (error) {
    console.error("Error fetching circle:", error);
    return NextResponse.json(
      { error: "서클 정보를 불러오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// PATCH /api/circles/[slug] - 서클 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { slug } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const circle = await prisma.circle.findUnique({
      where: { slug },
      include: { creator: true },
    });

    if (!circle) {
      return NextResponse.json({ error: "서클을 찾을 수 없습니다" }, { status: 404 });
    }

    if (circle.creator.userId !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const body = await request.json();

    const updatedCircle = await prisma.circle.update({
      where: { id: circle.id },
      data: {
        name: body.name,
        tagline: body.tagline,
        description: body.description,
        coverImage: body.coverImage,
        tags: body.tags,
        pricing: body.pricing,
        settings: body.settings,
      },
    });

    return NextResponse.json(updatedCircle);
  } catch (error) {
    console.error("Error updating circle:", error);
    return NextResponse.json(
      { error: "서클 수정 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
