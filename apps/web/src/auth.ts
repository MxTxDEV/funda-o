import "server-only";
import { authenticateUser, enforceRateLimit, loginSchema, logger, RATE_LIMITS, AppError } from "@vc/core";
import { getDb } from "@vc/db";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { clientIp } from "./lib/request-meta";

class RateLimited extends CredentialsSignin {
  override code = "rate_limited";
}
class Locked extends CredentialsSignin {
  override code = "locked";
}
class Unavailable extends CredentialsSignin {
  override code = "unavailable";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // Failed logins are expected and already written to the audit log; keep other errors structured.
    error(error) {
      const type = (error as { type?: string }).type ?? error.name;
      if (type === "CredentialsSignin") return;
      logger.error("authjs.error", { type, err: error });
    },
    warn(code) {
      logger.warn("authjs.warn", { code });
    },
  },
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = clientIp(request.headers);
        const userAgent = request.headers.get("user-agent");
        try {
          await enforceRateLimit(`login:ip:${ip}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.window);
          await enforceRateLimit(`login:email:${email}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.window);
        } catch (err) {
          if (err instanceof AppError && err.code === "RATE_LIMITED") throw new RateLimited();
          throw new Unavailable();
        }
        try {
          const result = await authenticateUser(getDb(), email, password, { ip, userAgent });
          if (!result.ok) {
            if (result.reason === "locked") throw new Locked();
            return null;
          }
          return {
            id: result.user.userId,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            sessionVersion: result.user.sessionVersion,
          };
        } catch (err) {
          if (err instanceof CredentialsSignin) throw err;
          logger.error("auth.authorize_failed", { err });
          throw new Unavailable();
        }
      },
    }),
  ],
});
