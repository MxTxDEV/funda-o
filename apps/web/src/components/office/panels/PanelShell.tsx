"use client";
import { X } from "lucide-react";

export function PanelShell({ title, eyebrow, onClose, children }: { title: React.ReactNode; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside
      className="pointer-events-auto absolute inset-y-3 right-3 z-40 flex w-[min(380px,calc(100%-24px))] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface/95 shadow-2xl backdrop-blur"
      role="dialog"
      aria-label={typeof title === "string" ? title : eyebrow}
      data-testid="office-panel"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h2 className="truncate text-base font-semibold">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar painel" className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground">
          <X className="size-4" />
        </button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">{children}</div>
    </aside>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function FutureNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-violet/30 bg-violet/10 px-3 py-2 text-xs text-violet">{children}</p>;
}
