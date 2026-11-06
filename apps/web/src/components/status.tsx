import {
  AGENT_STATUS_LABELS,
  APPROVAL_STATUS_LABELS,
  PRESENCE_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@vc/core/client";
import type { AgentStatus, ApprovalStatus, PresenceState, TaskPriority, TaskStatus } from "@vc/core/client";
import { FlaskConical } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const TASK_TONES: Record<TaskStatus, BadgeTone> = {
  pending: "neutral",
  queued: "cyan",
  in_progress: "blue",
  waiting_approval: "amber",
  completed: "green",
  failed: "red",
  cancelled: "neutral",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge tone={TASK_TONES[status]} data-status={status}>
      <span className="size-1.5 rounded-full bg-current" />
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

const PRIORITY_TONES: Record<TaskPriority, BadgeTone> = { low: "neutral", normal: "neutral", high: "amber", urgent: "red" };
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{TASK_PRIORITY_LABELS[priority]}</Badge>;
}

const APPROVAL_TONES: Record<ApprovalStatus, BadgeTone> = { pending: "amber", approved: "green", rejected: "red", cancelled: "neutral" };
export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge tone={APPROVAL_TONES[status]}>{APPROVAL_STATUS_LABELS[status]}</Badge>;
}

const AGENT_TONES: Record<AgentStatus, BadgeTone> = { active: "green", paused: "amber", archived: "neutral" };
export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <Badge tone={AGENT_TONES[status]}>{AGENT_STATUS_LABELS[status]}</Badge>;
}

export const PRESENCE_COLORS: Record<PresenceState, string> = {
  offline: "#4b5563",
  idle: "#22c55e",
  working: "#3d7bff",
  waiting_approval: "#f5a524",
  paused: "#8792a5",
};

export function PresenceBadge({ state }: { state: PresenceState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={state === "working" ? "size-2 rounded-full animate-pulse-ring" : "size-2 rounded-full"}
        style={{ backgroundColor: PRESENCE_COLORS[state] }}
      />
      {PRESENCE_LABELS[state]}
    </span>
  );
}

/** Marks demonstration data so it is never mistaken for real operational data. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="violet" className={className} title="Dado de demonstração (seed de demo)">
      <FlaskConical className="size-3" />
      DEMO
    </Badge>
  );
}
