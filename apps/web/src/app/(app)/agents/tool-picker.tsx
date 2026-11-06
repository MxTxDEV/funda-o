import { TOOL_CATALOG } from "@vc/core/client";

/** Checkbox list of the tool catalog. Every tool is read-only and "planned" in this phase. */
export function ToolPicker({ selected = [] }: { selected?: string[] }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Ferramentas autorizadas</legend>
      {TOOL_CATALOG.map((t) => (
        <label
          key={t.id}
          className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface-2/50 p-2.5 text-sm has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5"
        >
          <input type="checkbox" name="allowedTools" value={t.id} defaultChecked={selected.includes(t.id)} className="mt-0.5 accent-[#3d7bff]" />
          <span>
            <span className="block font-medium">{t.label}</span>
            <span className="block text-xs text-muted-foreground">{t.description}</span>
            <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-muted-foreground">Planejada · sem execução nesta fase</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
