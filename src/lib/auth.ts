import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      username: string;
      avatar?: string;
      role: "USER" | "CREATOR" | "ADMIN";
      creatorId?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    username: string;
    avatar?: string;
    role: "USER" | "CREATOR" | "ADMIN";
    creatorId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    username: string;
    avatar?: string;
    role: "USER" | "CREATOR" | "ADMIN";
    creatorId?: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signUp: "/signup",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("이메일과 비밀번호를 입력해주세요.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { creator: true },
        });

        if (!user || !user.passwordHash) {
          throw new Error("등록되지 않은 이메일입니다.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("비밀번호가 올바르지 않습니다.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || "",
          username: user.username,
          avatar: user.avatar || undefined,
          role: user.role,
          creatorId: user.creator?.id || undefined,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.username = user.username;
        token.avatar = user.avatar;
        token.role = user.role;
        token.creatorId = user.creatorId;
      }

      if (trigger === "update" && session) {
        token.name = session.name || token.name;
        token.avatar = session.avatar || token.avatar;
        token.role = session.role || token.role;
        token.creatorId = session.creatorId || token.creatorId;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.username = token.username;
        session.user.avatar = token.avatar;
        session.user.role = token.role;
        session.user.creatorId = token.creatorId;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "github") {
        // OAuth 로그인 시 username 자동 생성
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          const baseUsername = user.email!.split("@")[0];
          let username = baseUsername;
          let counter = 1;

          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}${counter}`;
            counter++;
          }

          await prisma.user.update({
            where: { email: user.email! },
            data: { username },
          });
        }
      }
      return true;
    },
  },
};
