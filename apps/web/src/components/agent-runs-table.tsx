import type { AgentRunRow } from "@vc/core";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  running: { label: "Em execução", tone: "blue" },
  succeeded: { label: "Concluída", tone: "green" },
  failed: { label: "Falhou", tone: "red" },
  aborted: { label: "Interrompida", tone: "neutral" },
};

export function formatTokens(input: number | null, output: number | null) {
  if (input === null && output === null) return "—";
  return `${(input ?? 0).toLocaleString("pt-BR")} → ${(output ?? 0).toLocaleString("pt-BR")}`;
}

export function formatCost(cost: number | null) {
  return cost === null ? "sem preço" : `US$ ${cost.toFixed(4)}`;
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Model executions (observability): who ran, which model, tokens, cost, duration and errors. */
export function AgentRunsTable({ runs, showAgent = true, showTask = true, empty }: { runs: AgentRunRow[]; showAgent?: boolean; showTask?: boolean; empty: string }) {
  if (runs.length === 0) return <p className="px-5 py-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Início</th>
            {showAgent && <th className="px-4 py-2 font-medium">Funcionário</th>}
            {showTask && <th className="px-4 py-2 font-medium">Tarefa</th>}
            <th className="px-4 py-2 font-medium">Modelo</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium" title="Tokens de entrada → saída">Tokens</th>
            <th className="px-4 py-2 font-medium">Custo est.</th>
            <th className="px-4 py-2 font-medium">Duração</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((r) => {
            const s = STATUS[r.status] ?? { label: r.status, tone: "neutral" as BadgeTone };
            return (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                  {formatDateTime(r.startedAt)}
                  <div className="text-[10px]">tentativa {r.attempt}</div>
                </td>
                {showAgent && (
                  <td className="px-4 py-2">
                    {r.agentId ? (
                      <Link href={`/agents/${r.agentId}`} className="hover:underline">
                        {r.agentName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {showTask && (
                  <td className="max-w-56 truncate px-4 py-2">
                    <Link href={`/tasks/${r.taskId}`} className="hover:underline" title={r.taskTitle}>
                      {r.taskTitle}
                    </Link>
                  </td>
                )}
                <td className="px-4 py-2 font-mono text-[11px]">
                  {r.provider}/{r.responseModel ?? r.model}
                </td>
                <td className="px-4 py-2">
                  <Badge tone={s.tone}>{s.label}</Badge>
                  {r.error && <div className="mt-1 max-w-64 text-[11px] text-[#ff9b9b]">{r.error.message}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{formatTokens(r.inputTokens, r.outputTokens)}</td>
                <td className="whitespace-nowrap px-4 py-2">{r.status === "running" ? "—" : formatCost(r.costUsd)}</td>
                <td className="whitespace-nowrap px-4 py-2">{formatDuration(r.durationMs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
