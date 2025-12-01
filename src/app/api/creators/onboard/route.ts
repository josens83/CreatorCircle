import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const onboardSchema = z.object({
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다"),
  username: z
    .string()
    .min(3, "사용자명은 최소 3자 이상이어야 합니다")
    .max(20, "사용자명은 최대 20자까지 가능합니다")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "사용자명은 영문, 숫자, 밑줄(_)만 사용할 수 있습니다"
    ),
  bio: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 이미 크리에이터인지 확인
    const existingCreator = await prisma.creator.findUnique({
      where: { userId: session.user.id },
    });

    if (existingCreator) {
      return NextResponse.json(
        { error: "이미 크리에이터로 등록되어 있습니다" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = onboardSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, username, bio } = validation.data;

    // 사용자명 중복 확인
    const existingUsername = await prisma.creator.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "이미 사용 중인 사용자명입니다" },
        { status: 400 }
      );
    }

    // 크리에이터 생성 및 사용자 역할 업데이트
    const [creator] = await prisma.$transaction([
      prisma.creator.create({
        data: {
          userId: session.user.id,
          name,
          username,
          bio,
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { role: "CREATOR" },
      }),
    ]);

    return NextResponse.json(creator, { status: 201 });
  } catch (error) {
    console.error("Error onboarding creator:", error);
    return NextResponse.json(
      { error: "크리에이터 등록 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
