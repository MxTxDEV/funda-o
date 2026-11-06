import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Redirects unauthenticated visitors to /login. Authorization is enforced again in every
// server action, route handler and service (defense in depth).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
