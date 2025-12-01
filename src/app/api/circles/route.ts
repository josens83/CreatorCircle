import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { slugify } from "@/lib/utils";

const createCircleSchema = z.object({
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다"),
  tagline: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["COMMUNITY", "NEWSLETTER", "HYBRID"]).default("HYBRID"),
  category: z.enum([
    "TECH",
    "BUSINESS",
    "FINANCE",
    "CAREER",
    "MARKETING",
    "DESIGN",
    "WRITING",
    "LIFESTYLE",
    "EDUCATION",
    "ENTERTAINMENT",
  ]),
  pricing: z.object({
    hasFreeTier: z.boolean().default(true),
    monthlyPrice: z.number().optional(),
    yearlyPrice: z.number().optional(),
    yearlyDiscount: z.number().optional(),
  }),
});

// GET /api/circles - 서클 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "trending";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");

    const where: any = {
      status: "ACTIVE",
      visibility: "PUBLIC",
    };

    if (category && category !== "all") {
      where.category = category.toUpperCase();
    }

    let orderBy: any = { memberCount: "desc" };
    if (sort === "newest") {
      orderBy = { createdAt: "desc" };
    } else if (sort === "members") {
      orderBy = { memberCount: "desc" };
    }

    const [circles, total] = await Promise.all([
      prisma.circle.findMany({
        where,
        include: {
          creator: {
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
          _count: {
            select: {
              posts: true,
              members: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.circle.count({ where }),
    ]);

    return NextResponse.json({
      circles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching circles:", error);
    return NextResponse.json(
      { error: "서클 목록을 불러오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// POST /api/circles - 새 서클 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 크리에이터인지 확인
    const creator = await prisma.creator.findUnique({
      where: { userId: session.user.id },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "크리에이터 등록이 필요합니다" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createCircleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, tagline, description, type, category, pricing } = validation.data;

    // slug 생성
    let slug = slugify(name);
    let counter = 1;
    while (await prisma.circle.findUnique({ where: { slug } })) {
      slug = `${slugify(name)}-${counter}`;
      counter++;
    }

    const circle = await prisma.circle.create({
      data: {
        creatorId: creator.id,
        name,
        slug,
        tagline,
        description,
        type,
        category,
        pricing,
        tags: [],
      },
      include: {
        creator: {
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

    return NextResponse.json(circle, { status: 201 });
  } catch (error) {
    console.error("Error creating circle:", error);
    return NextResponse.json(
      { error: "서클 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
