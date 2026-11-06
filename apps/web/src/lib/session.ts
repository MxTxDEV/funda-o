import "server-only";
import { getActiveUser, type ServiceContext, type UserActor } from "@vc/core";
import { getDb } from "@vc/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { clientIp } from "./request-meta";

/** Current user, re-validated against the database on every request (role changes and deactivation apply immediately). */
export const getActor = cache(async (): Promise<(UserActor & { name: string }) | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await getActiveUser(getDb(), userId);
  if (!user) return null;
  return { type: "user", userId: user.id, email: user.email, role: user.role, name: user.name };
});

export async function requireActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function requestMeta() {
  const h = await headers();
  return { ip: clientIp(h), userAgent: h.get("user-agent") };
}

export async function getServiceContext(): Promise<ServiceContext & { actor: UserActor & { name: string } }> {
  const actor = await requireActor();
  return { db: getDb(), actor, meta: await requestMeta() };
}
