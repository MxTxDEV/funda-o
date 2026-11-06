export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="h-8 w-64 animate-pulse rounded-md bg-surface-2" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-2/70" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-surface-2/50" />
    </div>
  );
}
