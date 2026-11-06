import { can, ROLE_LABELS } from "@vc/core";
import { approvals, getDb } from "@vc/db";
import { count, eq } from "drizzle-orm";
import { Logo } from "@/components/shell/logo";
import { Nav } from "@/components/shell/nav";
import { UserMenu } from "@/components/shell/user-menu";
import { requireActor } from "@/lib/session";
import { signOutAction } from "./actions/auth";

/** Long enough for the serverless task drain (see lib/drain.ts). */
export const maxDuration = 300;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const [pending] = can(actor, "approvals:read")
    ? await getDb().select({ value: count() }).from(approvals).where(eq(approvals.status, "pending"))
    : [{ value: 0 }];

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/70 px-3 py-4 backdrop-blur lg:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <Nav pendingApprovals={pending?.value ?? 0} canAudit={can(actor, "audit:read")} />
        <div className="mt-auto space-y-3">
          <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">FOUNDATION v1.0</span>
            <br />
            Central Brain e escritório 3D: próximas fases.
          </div>
          <UserMenu name={actor.name} email={actor.email} roleLabel={ROLE_LABELS[actor.role]} signOutAction={signOutAction} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <Logo compact />
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1.5 text-sm">Menu</summary>
            <div className="absolute right-0 mt-2 w-64 rounded-md border border-border-strong bg-surface p-2 shadow-xl">
              <Nav pendingApprovals={pending?.value ?? 0} canAudit={can(actor, "audit:read")} />
              <div className="mt-2 border-t border-border pt-2">
                <UserMenu name={actor.name} email={actor.email} roleLabel={ROLE_LABELS[actor.role]} signOutAction={signOutAction} />
              </div>
            </div>
          </details>
        </header>
        <main className="glow-top relative flex-1">
          <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_420px)]" />
          <div className="relative mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
