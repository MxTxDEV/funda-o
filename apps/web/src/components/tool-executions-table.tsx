import { getTool, type ToolExecutionRow } from "@vc/core";
import Link from "next/link";
import { formatDuration } from "@/components/agent-runs-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  succeeded: { label: "Executada", tone: "green" },
  failed: { label: "Falhou", tone: "red" },
  denied: { label: "Recusada", tone: "amber" },
};

export function ToolExecutionsTable({ rows, showTask = true, empty }: { rows: ToolExecutionRow[]; showTask?: boolean; empty: string }) {
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Quando</th>
            <th className="px-4 py-2 font-medium">Ferramenta</th>
            <th className="px-4 py-2 font-medium">Funcionário</th>
            {showTask && <th className="px-4 py-2 font-medium">Tarefa</th>}
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Resultado</th>
            <th className="px-4 py-2 font-medium">Duração</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const s = STATUS[r.status] ?? { label: r.status, tone: "neutral" as BadgeTone };
            return (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{formatDateTime(r.startedAt)}</td>
                <td className="px-4 py-2">
                  {getTool(r.toolId)?.label ?? r.toolId}
                  <div className="font-mono text-[10px] text-muted-foreground">{r.toolId}</div>
                </td>
                <td className="px-4 py-2">{r.agentName ?? "—"}</td>
                {showTask && (
                  <td className="max-w-48 truncate px-4 py-2">
                    {r.taskId ? (
                      <Link href={`/tasks/${r.taskId}`} className="hover:underline" title={r.taskTitle ?? ""}>
                        {r.taskTitle}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-4 py-2">
                  <Badge tone={s.tone}>{s.label}</Badge>
                </td>
                <td className="max-w-80 px-4 py-2 text-muted-foreground">{r.summary || r.error || "—"}</td>
                <td className="whitespace-nowrap px-4 py-2">{formatDuration(r.durationMs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
