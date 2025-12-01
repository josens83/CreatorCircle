import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { slugify } from "@/lib/utils";

const createPostSchema = z.object({
  circleId: z.string(),
  title: z.string().min(1, "제목을 입력해주세요"),
  content: z.string().min(1, "내용을 입력해주세요"),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  type: z.enum(["ARTICLE", "QUESTION", "DISCUSSION", "ANNOUNCEMENT", "POLL"]).default("ARTICLE"),
  accessType: z.enum(["PUBLIC", "FREE_MEMBERS", "PAID", "TIER"]).default("PAID"),
  requiredTierId: z.string().optional(),
  sendAsEmail: z.boolean().default(false),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).default("DRAFT"),
  scheduledAt: z.string().optional(),
});

// GET /api/posts - 포스트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const circleId = searchParams.get("circleId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const session = await getServerSession(authOptions);

    const where: any = {};

    if (circleId) {
      where.circleId = circleId;

      // 공개 포스트만 보거나, 멤버인 경우 모든 포스트 보기
      if (session?.user) {
        const membership = await prisma.member.findUnique({
          where: {
            userId_circleId: {
              userId: session.user.id,
              circleId,
            },
          },
          include: { tier: true },
        });

        if (membership) {
          // 멤버인 경우 접근 가능한 포스트만
          where.OR = [
            { accessType: "PUBLIC" },
            { accessType: "FREE_MEMBERS" },
            ...(membership.memberType === "PAID" || membership.memberType === "LIFETIME"
              ? [{ accessType: "PAID" }]
              : []),
          ];
        } else {
          // 비멤버는 공개 포스트만
          where.accessType = "PUBLIC";
        }
      } else {
        where.accessType = "PUBLIC";
      }
    }

    if (status) {
      where.status = status.toUpperCase();
    } else {
      where.status = "PUBLISHED";
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            include: {
              user: {
                select: {
                  name: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
          circle: {
            select: {
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
        orderBy: [
          { isPinned: "desc" },
          { publishedAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "포스트 목록을 불러오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// POST /api/posts - 새 포스트 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createPostSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 서클 및 작성 권한 확인
    const circle = await prisma.circle.findUnique({
      where: { id: data.circleId },
      include: { creator: true },
    });

    if (!circle) {
      return NextResponse.json({ error: "서클을 찾을 수 없습니다" }, { status: 404 });
    }

    // 크리에이터 본인인지 확인
    if (circle.creator.userId !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 멤버 정보 가져오기 (작성자로 설정)
    let member = await prisma.member.findUnique({
      where: {
        userId_circleId: {
          userId: session.user.id,
          circleId: circle.id,
        },
      },
    });

    // 크리에이터가 멤버가 아닌 경우 자동 등록
    if (!member) {
      member = await prisma.member.create({
        data: {
          userId: session.user.id,
          circleId: circle.id,
          memberType: "LIFETIME",
        },
      });
    }

    // slug 생성
    let slug = slugify(data.title);
    let counter = 1;
    while (
      await prisma.post.findUnique({
        where: { circleId_slug: { circleId: circle.id, slug } },
      })
    ) {
      slug = `${slugify(data.title)}-${counter}`;
      counter++;
    }

    const post = await prisma.post.create({
      data: {
        circleId: circle.id,
        authorId: member.id,
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImage: data.coverImage,
        type: data.type,
        accessType: data.accessType,
        requiredTierId: data.requiredTierId,
        sendAsEmail: data.sendAsEmail,
        status: data.status,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
      include: {
        author: {
          include: {
            user: {
              select: {
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // 서클 포스트 수 업데이트
    if (data.status === "PUBLISHED") {
      await prisma.circle.update({
        where: { id: circle.id },
        data: { postCount: { increment: 1 } },
      });

      await prisma.creator.update({
        where: { id: circle.creator.id },
        data: { totalPosts: { increment: 1 } },
      });
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "포스트 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
