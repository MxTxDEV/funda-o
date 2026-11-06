"use client";
import { getTool } from "@vc/core/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import type { FixedRoomKey } from "../layout";
import { FIXED_ROOM_LABELS } from "../layout";
import { useOfficeStore } from "../store";
import type { OfficeSnapshot } from "../types";
import { FutureNote, PanelShell, Section, Stat } from "./PanelShell";

/** Panels for the shared rooms. They only show data that exists in the system. */
export function RoomPanel({ room, snapshot, onClose }: { room: FixedRoomKey; snapshot: OfficeSnapshot; onClose: () => void }) {
  const select = useOfficeStore((s) => s.select);
  const { brain, metrics } = snapshot;

  if (room === "brain") {
    return (
      <PanelShell eyebrow="Inteligência central" title="Central Brain" onClose={onClose}>
        <FutureNote>
          O motor de IA do Central Brain ainda não está integrado (FOUNDATION v1.0). Os dados abaixo são da infraestrutura de execução real
          que ele usará.
        </FutureNote>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Agentes conectados (ativos e versionados)" value={brain.connectedAgents} />
          <Stat label="Tarefas ativas" value={metrics.activeTasks} />
          <Stat label="Concluídas em 24h" value={brain.completedLast24h} />
          <Stat label="Falhas em 24h" value={brain.failedLast24h} />
        </div>
        <Section title="Fila de execução">
          {brain.queue ? (
            <p className="text-xs text-muted-foreground">
              {brain.queue.waiting} aguardando · {brain.queue.active} executando · {brain.queue.delayed} em nova tentativa ·{" "}
              {brain.executionMode === "serverless" ? "execução sob demanda (Vercel)" : brain.queue.workerOnline ? "worker online" : "worker offline"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Fila indisponível no momento.</p>
          )}
        </Section>
        <Section title="Ferramentas autorizadas aos agentes">
          <div className="flex flex-wrap gap-1.5">
            {brain.authorizedTools.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma.</span>}
            {brain.authorizedTools.map((t) => (
              <Badge key={t} tone="blue">
                {getTool(t)?.label ?? t}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Todas planejadas; nenhuma publica anúncios ou gera gastos nesta fase.</p>
        </Section>
        <Section title="Agentes conectados">
          <ul className="space-y-1">
            {snapshot.agents
              .filter((a) => a.status === "active")
              .map((a) => (
                <li key={a.id}>
                  <button type="button" className="w-full rounded px-2 py-1 text-left text-xs hover:bg-surface-2" onClick={() => select({ kind: "agent", id: a.id })}>
                    {a.name} <span className="text-muted-foreground">· v{a.version ?? "—"}</span>
                  </button>
                </li>
              ))}
          </ul>
        </Section>
      </PanelShell>
    );
  }

  if (room === "executive") {
    return (
      <PanelShell eyebrow="Gestão" title={FIXED_ROOM_LABELS.executive} onClose={onClose}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Aprovações pendentes" value={metrics.pendingApprovals} />
          <Stat label="Tarefas ativas" value={metrics.activeTasks} />
        </div>
        <p className="text-xs text-muted-foreground">Área de decisões: aprovações são feitas pelo módulo de Aprovações, com controle de concorrência e auditoria.</p>
        <Button asChild className="w-full">
          <Link href="/approvals?status=pending">Abrir aprovações pendentes</Link>
        </Button>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/">Centro de comando</Link>
        </Button>
      </PanelShell>
    );
  }

  if (room === "meeting") {
    return (
      <PanelShell eyebrow="Colaboração" title={FIXED_ROOM_LABELS.meeting} onClose={onClose}>
        <Stat label="Reuniões ativas" value={0} />
        <FutureNote>Reuniões entre agentes serão registradas quando o Central Brain coordenar a colaboração. Nenhuma reunião é simulada.</FutureNote>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/conversations">Abrir conversas de departamento e gerais</Link>
        </Button>
      </PanelShell>
    );
  }

  const resting = snapshot.agents.filter((a) => a.officeStatus === "resting");
  return (
    <PanelShell eyebrow="Descanso" title={FIXED_ROOM_LABELS.lounge} onClose={onClose}>
      <p className="text-xs text-muted-foreground">Funcionários com status <b>Pausado</b> ficam na sala de lazer até serem reativados.</p>
      {resting.length === 0 ? (
        <p className="text-muted-foreground">Ninguém em descanso agora.</p>
      ) : (
        <ul className="space-y-1">
          {resting.map((a) => (
            <li key={a.id}>
              <button type="button" className="w-full rounded px-2 py-1 text-left text-xs hover:bg-surface-2" onClick={() => select({ kind: "agent", id: a.id })}>
                {a.name} <span className="text-muted-foreground">· {a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Atualizado {formatRelative(snapshot.generatedAt)}</p>
    </PanelShell>
  );
}
