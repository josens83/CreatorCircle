import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const signupSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
    .regex(/[A-Za-z]/, "비밀번호에 영문자가 포함되어야 합니다")
    .regex(/[0-9]/, "비밀번호에 숫자가 포함되어야 합니다"),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다"),
  username: z
    .string()
    .min(3, "사용자명은 최소 3자 이상이어야 합니다")
    .max(20, "사용자명은 최대 20자까지 가능합니다")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "사용자명은 영문, 숫자, 밑줄(_)만 사용할 수 있습니다"
    ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = signupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, name, username } = validation.data;

    // 이메일 중복 확인
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다" },
        { status: 400 }
      );
    }

    // 사용자명 중복 확인
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "이미 사용 중인 사용자명입니다" },
        { status: 400 }
      );
    }

    // 비밀번호 해시
    const passwordHash = await bcrypt.hash(password, 12);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        username,
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "회원가입이 완료되었습니다",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
