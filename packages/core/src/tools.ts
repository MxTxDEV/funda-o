/**
 * Catalog of tools an agent version may be authorized to use.
 *
 * FOUNDATION phase: no tool is executable yet (status "planned"). The catalog exists so that
 * agent versions can declare authorizations that the Central Brain will enforce later.
 * Hard rule: no tool may publish ads or spend money in this phase (`allowsSpend` must be false).
 */
export type ToolDefinition = {
  id: string;
  label: string;
  category: "research" | "content" | "creative" | "offers" | "campaigns" | "analytics";
  description: string;
  status: "planned";
  readOnly: boolean;
  allowsSpend: false;
};

export const TOOL_CATALOG = [
  {
    id: "research.market",
    label: "Pesquisa de mercado",
    category: "research",
    description: "Coleta e síntese de informações públicas de mercado e concorrência.",
    status: "planned",
    readOnly: true,
    allowsSpend: false,
  },
  {
    id: "research.audience",
    label: "Análise de público",
    category: "research",
    description: "Mapeamento de personas, dores e desejos do público-alvo.",
    status: "planned",
    readOnly: true,
    allowsSpend: false,
  },
  {
    id: "content.copywriting",
    label: "Copywriting",
    category: "content",
    description: "Redação de textos persuasivos para anúncios, páginas e e-mails (rascunhos).",
    status: "planned",
    readOnly: true,
    allowsSpend: false,
  },
  {
    id: "creative.briefing",
    label: "Briefing de criativos",
    category: "creative",
    description: "Geração de briefings e roteiros para peças criativas.",
    status: "planned",
    readOnly: true,
    allowsSpend: false,
  },
  {
    id: "offers.design",
    label: "Desenvolvimento de ofertas",
    category: "offers",
    description: "Estruturação de ofertas, bônus, garantias e precificação (proposta).",
    status: "planned",
    readOnly: true,
    allowsSpend: false,
  },
  {
    id: "campaigns.plan",
    label: "Planejamento de campanhas",
    category: "campaigns",
    description: "Planejamento de estrutura de campanhas. Não publica nem altera campanhas.",
    status: "planned",
    readOnly: true,
    allowsSpend: false,
  },
  {
    id: "analytics.meta_ads.read",
    label: "Meta Ads (somente leitura)",
    category: "analytics",
    description: "Leitura de métricas do Meta Ads. Publicação e gastos estão bloqueados nesta fase.",
    status: "planned",
    readOnly: true,
    allowsSpend: false,
  },
] as const satisfies readonly ToolDefinition[];

export type ToolId = (typeof TOOL_CATALOG)[number]["id"];

export const TOOL_IDS = TOOL_CATALOG.map((t) => t.id) as [ToolId, ...ToolId[]];

export function isKnownTool(id: string): id is ToolId {
  return (TOOL_IDS as readonly string[]).includes(id);
}

export function getTool(id: string): ToolDefinition | undefined {
  return TOOL_CATALOG.find((t) => t.id === id);
}
