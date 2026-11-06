import { PRESENCE_LABELS, type PresenceState } from "@vc/core/client";
import Link from "next/link";
import { AgentAvatar } from "./agent-avatar";
import { PRESENCE_COLORS } from "./status";

export type FloorAgent = {
  id: string;
  name: string;
  title: string;
  avatarSeed: string;
  avatarUrl: string | null;
  isDemo: boolean;
  department: { id: string; name: string; color: string; isActive: boolean };
  presence: { state: PresenceState; statusMessage: string } | null;
};

/**
 * Top-down office floor: each department is a room, each agent sits at a desk.
 * The desk light reflects the agent's real presence (synced from tasks). Placeholder for the future 3D office.
 */
export function OfficeFloor({ agents }: { agents: FloorAgent[] }) {
  const rooms = new Map<string, { dept: FloorAgent["department"]; agents: FloorAgent[] }>();
  for (const a of agents) {
    const room = rooms.get(a.department.id) ?? { dept: a.department, agents: [] };
    room.agents.push(a);
    rooms.set(a.department.id, room);
  }

  return (
    <div className="office-floor grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2 2xl:grid-cols-3">
      {[...rooms.values()].map(({ dept, agents: people }) => (
        <section
          key={dept.id}
          className="relative overflow-hidden rounded-md border bg-[#0d1219]/90 p-3"
          style={{ borderColor: `${dept.color}55`, boxShadow: `inset 0 1px 0 ${dept.color}33` }}
          aria-label={`Sala ${dept.name}`}
        >
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: dept.color }} />
          <header className="mb-3 flex items-center justify-between gap-2">
            <Link href={`/departments/${dept.id}`} className="truncate text-xs font-semibold uppercase tracking-wider hover:underline" style={{ color: dept.color }}>
              {dept.name}
            </Link>
            <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
              {people.length} {people.length === 1 ? "posto" : "postos"}
              {!dept.isActive && " · inativo"}
            </span>
          </header>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
            {people.map((a) => {
              const state = a.presence?.state ?? "offline";
              const color = PRESENCE_COLORS[state];
              return (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  title={`${a.name} — ${PRESENCE_LABELS[state]}${a.presence?.statusMessage ? `: ${a.presence.statusMessage}` : ""}`}
                  className="group relative flex flex-col items-center rounded-md border border-border/80 bg-surface-2/70 px-2 pb-2 pt-3 transition hover:border-primary/60 hover:bg-surface-3"
                >
                  {/* desk + monitor glow */}
                  <span
                    className="absolute inset-x-3 bottom-1 h-1 rounded-full opacity-70 blur-[2px]"
                    style={{ background: color, opacity: state === "offline" ? 0.15 : 0.6 }}
                  />
                  <AgentAvatar seed={a.avatarSeed} url={a.avatarUrl} name={a.name} size={40} presence={state} />
                  <span className="mt-2 w-full truncate text-center text-[11px] font-medium">{a.name}</span>
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">{a.title}</span>
                  {a.isDemo && <span className="absolute right-1 top-1 rounded bg-violet/20 px-1 text-[9px] font-semibold text-violet">DEMO</span>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
