export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center rounded-lg border border-primary/40 bg-gradient-to-br from-primary/30 to-transparent shadow-[0_0_24px_-6px_rgba(61,123,255,0.8)]">
        <svg viewBox="0 0 64 64" className="size-5" aria-hidden>
          <path d="M14 18l18 30 18-30" fill="none" stroke="#7aa2ff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="16" r="4.5" fill="#22d3ee" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Virtual Company</span>
          <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Command Center</span>
        </span>
      )}
    </span>
  );
}
