import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration (no database access). Used by the proxy for the
 * coarse "is there a session?" check. Real authorization happens in the backend
 * (services check permissions against the user's current role in the database).
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.VERCEL === "1",
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const loggedIn = !!auth?.user;
      if (pathname === "/login") {
        return loggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      // API handlers answer 401 JSON themselves.
      if (pathname.startsWith("/api/")) return true;
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
} satisfies NextAuthConfig;
