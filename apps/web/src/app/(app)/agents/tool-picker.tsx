import { getTool, LEGACY_CAPABILITIES, TOOL_CATALOG, TOOL_CATEGORY_LABELS } from "@vc/core/client";

/**
 * Tool grants of an agent version. Executable tools are marked; planned ones can be granted ahead
 * of time but are never offered to a model until they are implemented. FOUNDATION-era capability ids
 * already on the version stay listed so saving a new version does not silently drop them.
 */
export function ToolPicker({ selected = [] }: { selected?: string[] }) {
  const legacySelected = LEGACY_CAPABILITIES.filter((c) => selected.includes(c.id));
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Ferramentas autorizadas</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {TOOL_CATALOG.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface-2/50 p-2.5 text-sm has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5"
          >
            <input type="checkbox" name="allowedTools" value={t.id} defaultChecked={selected.includes(t.id)} className="mt-0.5 accent-[#3d7bff]" />
            <span>
              <span className="block font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.description}</span>
              <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-muted-foreground">
                {TOOL_CATEGORY_LABELS[t.category]} · exige nível {t.riskLevel} · {t.status === "available" ? "executável" : "planejada"}
              </span>
            </span>
          </label>
        ))}
      </div>
      {legacySelected.length > 0 && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-2.5">
          <p className="text-xs text-muted-foreground">Autorizações antigas (mantidas; equivalem às ferramentas indicadas):</p>
          {legacySelected.map((c) => (
            <label key={c.id} className="flex items-start gap-2 text-xs">
              <input type="checkbox" name="allowedTools" value={c.id} defaultChecked className="mt-0.5 accent-[#3d7bff]" />
              <span>
                {c.label} → {c.grants.map((g) => getTool(g)?.label ?? g).join(", ")}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
