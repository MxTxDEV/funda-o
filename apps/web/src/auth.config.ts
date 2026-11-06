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
      // The login page is always reachable: a cookie may hold a session that the backend no longer
      // accepts (password changed, user deactivated). Redirecting it away would loop.
      if (pathname === "/login") return true;
      // API handlers answer 401 JSON themselves.
      if (pathname.startsWith("/api/")) return true;
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.uid === "string") session.user.id = token.uid;
      if (session.user) session.user.sv = typeof token.sv === "number" ? token.sv : 0;
      return session;
    },
  },
} satisfies NextAuthConfig;
