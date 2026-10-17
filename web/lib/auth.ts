import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "guest",
      name: "Try Cortex",
      credentials: {},
      async authorize() {
        const id = randomUUID();
        return prisma.user.create({
          data: {
            id,
            email: `${id}@guest.cortex.invalid`,
            name: "Guest",
            provider: "guest",
            providerId: id,
          },
        });
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.isGuest = account.provider === "guest";
        token.guestExpiresAt = token.isGuest ? Date.now() + 24 * 60 * 60 * 1000 : undefined;
      }
      if (token.isGuest && Number(token.guestExpiresAt) <= Date.now()) return null;
      return token;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name ?? undefined,
              avatarUrl: user.image ?? undefined,
            },
            create: {
              email: user.email,
              name: user.name,
              avatarUrl: user.image,
              provider: "google",
              providerId: account.providerAccountId,
            },
          });
        } catch (err) {
          console.error("[auth] Failed to upsert user:", err);
        }
      }
      return true;
    },
    async session({ session, token }) {
      session.user.isGuest = token.isGuest === true;
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
        }
      }
      return session;
    },
  },
});
