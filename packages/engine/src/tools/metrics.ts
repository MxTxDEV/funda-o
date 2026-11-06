import { z } from "zod";
import { defineTool } from "./types";

const nonNeg = z.number().min(0).finite();
const row = z.object({
  label: z.string().min(1).max(120).describe("Nome da campanha, conjunto ou período"),
  source: z.string().min(3).max(300).describe("Origem verificável dos números (ex.: relatório Meta Ads de 01-07/05, planilha X)"),
  spend: nonNeg.describe("Investimento"),
  impressions: nonNeg.optional(),
  clicks: nonNeg.optional(),
  conversions: nonNeg.optional(),
  revenue: nonNeg.optional(),
  currency: z.string().max(5).default("BRL"),
});

const ratio = (a: number | undefined, b: number | undefined, mult = 1) =>
  a === undefined || b === undefined || b === 0 ? null : Math.round((a / b) * mult * 10000) / 10000;

export const FORMULAS = {
  ctr: "cliques ÷ impressões × 100",
  cpc: "investimento ÷ cliques",
  cpm: "investimento ÷ impressões × 1000",
  cpa: "investimento ÷ conversões",
  roas: "receita ÷ investimento",
  cvr: "conversões ÷ cliques × 100",
};

export function computeRow(r: z.infer<typeof row>) {
  return {
    label: r.label,
    source: r.source,
    currency: r.currency,
    inputs: { spend: r.spend, impressions: r.impressions ?? null, clicks: r.clicks ?? null, conversions: r.conversions ?? null, revenue: r.revenue ?? null },
    ctrPct: ratio(r.clicks, r.impressions, 100),
    cpc: ratio(r.spend, r.clicks),
    cpm: ratio(r.spend, r.impressions, 1000),
    cpa: ratio(r.spend, r.conversions),
    roas: ratio(r.revenue, r.spend),
    cvrPct: ratio(r.conversions, r.clicks, 100),
  };
}

/** Deterministic marketing metrics: every number traceable to its inputs, formulas and declared source. */
export const computeMetrics = defineTool({
  modelDescription:
    "Calcula métricas de marketing (CTR, CPC, CPM, CPA, ROAS, taxa de conversão) a partir de números com origem identificada, e compara as linhas. Nunca invente números: use apenas dados fornecidos pelo proprietário ou obtidos por ferramentas.",
  inputSchema: z.object({ rows: z.array(row).min(1).max(50) }),
  async run(input) {
    const rows = input.rows.map(computeRow);
    const sum = (k: keyof (typeof rows)[number]["inputs"]) =>
      rows.every((r) => r.inputs[k] !== null) ? rows.reduce((a, r) => a + (r.inputs[k] as number), 0) : undefined;
    const totals = computeRow({
      label: "Total",
      source: "soma das linhas",
      currency: rows[0]!.currency,
      spend: sum("spend") ?? 0,
      impressions: sum("impressions"),
      clicks: sum("clicks"),
      conversions: sum("conversions"),
      revenue: sum("revenue"),
    });
    const best = (k: "cpa" | "roas", dir: 1 | -1) =>
      rows.filter((r) => r[k] !== null).sort((a, b) => dir * ((a[k] as number) - (b[k] as number)))[0]?.label ?? null;
    const comparison = { lowestCpa: best("cpa", 1), highestRoas: best("roas", -1) };
    const fmt = (v: number | null) => (v === null ? "n/d" : String(v));
    return {
      summary: `Métricas calculadas para ${rows.length} linha(s)`,
      content: [
        "Fórmulas: " + Object.entries(FORMULAS).map(([k, v]) => `${k.toUpperCase()} = ${v}`).join("; "),
        ...[...rows, totals].map(
          (r) => `${r.label} [fonte: ${r.source}]: CTR ${fmt(r.ctrPct)}% · CPC ${fmt(r.cpc)} · CPM ${fmt(r.cpm)} · CPA ${fmt(r.cpa)} · ROAS ${fmt(r.roas)} · conversão ${fmt(r.cvrPct)}%`,
        ),
        `Menor CPA: ${comparison.lowestCpa ?? "n/d"} · Maior ROAS: ${comparison.highestRoas ?? "n/d"}`,
        "n/d = não calculável (dado ausente ou divisão por zero).",
      ].join("\n"),
      data: { formulas: FORMULAS, rows, totals, comparison },
    };
  },
});
