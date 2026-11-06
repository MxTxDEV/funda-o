/**
 * Tool Registry (metadata, client-safe). The executable handlers live in @vc/engine and are looked up
 * by id; a tool without a handler is never offered to a model.
 *
 * Security model:
 * - an employee may only use tools granted on its agent version (`allowedTools`);
 * - each tool requires a minimum AUTONOMY LEVEL, configured per employee by the owner;
 * - level-4 tools (external actions) additionally require a valid owner approval and are not
 *   executable in this phase;
 * - every call is validated, rate limited and logged (tool_executions).
 */

export const AUTONOMY_LEVELS = [1, 2, 3, 4] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LABELS: Record<AutonomyLevel, { name: string; description: string }> = {
  1: { name: "Nível 1 — Consulta", description: "Pesquisa e consulta informações." },
  2: { name: "Nível 2 — Produção", description: "Produz documentos, textos, imagens e materiais internos." },
  3: { name: "Nível 3 — Preparação de ações", description: "Prepara campanhas, publicações e alterações externas, sem executá-las." },
  4: { name: "Nível 4 — Execução autorizada", description: "Executa ações externas somente após aprovação válida do proprietário." },
};

export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = 2;

export type ToolCategory = "research" | "documents" | "content" | "images" | "development" | "analytics" | "internal" | "meta_ads";

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  research: "Pesquisa na internet",
  documents: "Documentos",
  content: "Produção de conteúdo",
  images: "Geração de imagens",
  development: "Desenvolvimento",
  analytics: "Análise de dados",
  internal: "Consulta interna",
  meta_ads: "Meta Ads",
};

export type ToolDefinition = {
  id: string;
  label: string;
  category: ToolCategory;
  description: string;
  /** "available": has a handler; "planned": declared, not executable yet. */
  status: "available" | "planned";
  /** Minimum autonomy level of the employee (1 consult … 4 authorized external execution). */
  riskLevel: AutonomyLevel;
  sideEffects: "none" | "internal_write" | "external_write";
  /** What the tool touches (shown to the owner). */
  permissions: readonly string[];
  limits: { perRun: number; perDayPerAgent: number };
  /** Backend environment variables required (names only). The tool is hidden while any is missing. */
  requiresEnv?: readonly string[];
  /** Legacy capability ids (FOUNDATION) that keep working as grants for these tools. */
  legacy?: false;
};

/** FOUNDATION-era capability ids still stored on agent versions; they grant concrete tools. */
export type LegacyCapability = {
  id: string;
  label: string;
  description: string;
  legacy: true;
  grants: readonly string[];
};

export const TOOL_CATALOG = [
  {
    id: "web.search",
    label: "Pesquisa na web",
    category: "research",
    description: "Pesquisa palavras-chave, concorrentes e tendências em um buscador oficial (Brave Search API). Os resultados ficam registrados como fontes.",
    status: "available",
    riskLevel: 1,
    sideEffects: "none",
    permissions: ["internet: API de busca", "registra fontes da tarefa"],
    limits: { perRun: 6, perDayPerAgent: 100 },
    requiresEnv: ["BRAVE_SEARCH_API_KEY"],
  },
  {
    id: "web.fetch_page",
    label: "Ler página pública",
    category: "research",
    description: "Lê o texto de uma página pública (sites, páginas de vendas, concorrentes). Bloqueia endereços internos; o conteúdo é tratado como não confiável.",
    status: "available",
    riskLevel: 1,
    sideEffects: "none",
    permissions: ["internet: somente páginas públicas http/https", "registra fontes da tarefa"],
    limits: { perRun: 8, perDayPerAgent: 200 },
  },
  {
    id: "analytics.compute_metrics",
    label: "Calcular métricas de marketing",
    category: "analytics",
    description: "Calcula CTR, CPC, CPM, CPA, ROAS e taxa de conversão a partir de dados informados com origem identificada. Mostra fórmulas e entradas.",
    status: "available",
    riskLevel: 1,
    sideEffects: "none",
    permissions: ["somente cálculo local"],
    limits: { perRun: 10, perDayPerAgent: 500 },
  },
  {
    id: "tasks.lookup",
    label: "Consultar tarefas",
    category: "internal",
    description: "Consulta tarefas e resultados já produzidos pela empresa (somente leitura).",
    status: "available",
    riskLevel: 1,
    sideEffects: "none",
    permissions: ["banco: leitura de tarefas"],
    limits: { perRun: 6, perDayPerAgent: 300 },
  },
  // ---- declared for the next phases (not executable, never offered to a model)
  {
    id: "docs.create",
    label: "Criar documento",
    category: "documents",
    description: "Cria documentos e relatórios associados a um projeto (Central de Entregas).",
    status: "planned",
    riskLevel: 2,
    sideEffects: "internal_write",
    permissions: ["banco: entregas do projeto"],
    limits: { perRun: 5, perDayPerAgent: 100 },
  },
  {
    id: "docs.read_file",
    label: "Ler arquivos e PDFs",
    category: "documents",
    description: "Lê e resume arquivos enviados ao projeto (texto e PDF).",
    status: "planned",
    riskLevel: 1,
    sideEffects: "none",
    permissions: ["arquivos do projeto: leitura"],
    limits: { perRun: 6, perDayPerAgent: 200 },
  },
  {
    id: "images.generate",
    label: "Gerar imagens publicitárias",
    category: "images",
    description: "Gera conceitos visuais e variações de criativos com um provedor oficial de imagens.",
    status: "planned",
    riskLevel: 2,
    sideEffects: "internal_write",
    permissions: ["API de imagens (custo por imagem)", "armazenamento de arquivos"],
    limits: { perRun: 4, perDayPerAgent: 40 },
  },
  {
    id: "dev.run_sandbox",
    label: "Executar código em sandbox",
    category: "development",
    description: "Executa testes de páginas e código gerado em ambiente isolado com limites de recursos.",
    status: "planned",
    riskLevel: 2,
    sideEffects: "none",
    permissions: ["sandbox isolado, sem acesso ao sistema"],
    limits: { perRun: 3, perDayPerAgent: 30 },
  },
  {
    id: "meta_ads.read",
    label: "Meta Ads — consulta",
    category: "meta_ads",
    description: "Consulta contas, campanhas, conjuntos, anúncios e métricas pela Marketing API oficial (somente leitura).",
    status: "planned",
    riskLevel: 1,
    sideEffects: "none",
    permissions: ["Meta Marketing API: ads_read"],
    limits: { perRun: 10, perDayPerAgent: 300 },
  },
  {
    id: "meta_ads.prepare_change",
    label: "Meta Ads — preparar alteração",
    category: "meta_ads",
    description: "Prepara criação de campanhas ou mudanças de orçamento como proposta para aprovação. Não executa nada.",
    status: "planned",
    riskLevel: 3,
    sideEffects: "internal_write",
    permissions: ["cria pedido de aprovação"],
    limits: { perRun: 3, perDayPerAgent: 20 },
  },
  {
    id: "meta_ads.execute_change",
    label: "Meta Ads — executar alteração aprovada",
    category: "meta_ads",
    description: "Executa na Meta uma alteração já aprovada pelo proprietário, conferindo o hash do conteúdo aprovado.",
    status: "planned",
    riskLevel: 4,
    sideEffects: "external_write",
    permissions: ["Meta Marketing API: ads_management", "exige aprovação válida"],
    limits: { perRun: 1, perDayPerAgent: 10 },
  },
] as const satisfies readonly ToolDefinition[];

export const LEGACY_CAPABILITIES = [
  { id: "research.market", label: "Pesquisa de mercado", description: "Autorização antiga: concede pesquisa e leitura de páginas.", legacy: true, grants: ["web.search", "web.fetch_page"] },
  { id: "research.audience", label: "Análise de público", description: "Autorização antiga: concede pesquisa e leitura de páginas.", legacy: true, grants: ["web.search", "web.fetch_page"] },
  { id: "content.copywriting", label: "Copywriting", description: "Autorização antiga: produção de textos pelo próprio modelo.", legacy: true, grants: ["tasks.lookup"] },
  { id: "creative.briefing", label: "Briefing de criativos", description: "Autorização antiga: briefings pelo próprio modelo.", legacy: true, grants: ["tasks.lookup"] },
  { id: "offers.design", label: "Desenvolvimento de ofertas", description: "Autorização antiga: ofertas pelo próprio modelo.", legacy: true, grants: ["tasks.lookup"] },
  { id: "campaigns.plan", label: "Planejamento de campanhas", description: "Autorização antiga: planejamento pelo próprio modelo.", legacy: true, grants: ["tasks.lookup", "analytics.compute_metrics"] },
  { id: "analytics.meta_ads.read", label: "Meta Ads (somente leitura)", description: "Autorização antiga: concede cálculo de métricas (e consulta Meta Ads quando conectada).", legacy: true, grants: ["analytics.compute_metrics", "meta_ads.read"] },
] as const satisfies readonly LegacyCapability[];

export type ToolId = (typeof TOOL_CATALOG)[number]["id"] | (typeof LEGACY_CAPABILITIES)[number]["id"];

export const TOOL_IDS = [...TOOL_CATALOG.map((t) => t.id), ...LEGACY_CAPABILITIES.map((t) => t.id)] as [ToolId, ...ToolId[]];

export function isKnownTool(id: string): id is ToolId {
  return (TOOL_IDS as readonly string[]).includes(id);
}

export function getToolDefinition(id: string): ToolDefinition | undefined {
  return (TOOL_CATALOG as readonly ToolDefinition[]).find((t) => t.id === id);
}

/** Label/description of a tool or legacy capability (for display). */
export function getTool(id: string): { id: string; label: string; description: string; status: string } | undefined {
  const t = getToolDefinition(id);
  if (t) return t;
  const l = (LEGACY_CAPABILITIES as readonly LegacyCapability[]).find((c) => c.id === id);
  return l ? { id: l.id, label: l.label, description: l.description, status: "legacy" } : undefined;
}

/** Concrete tool ids granted by a version's `allowedTools` (legacy capabilities expanded). */
export function expandToolGrants(allowed: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of allowed) {
    const legacy = (LEGACY_CAPABILITIES as readonly LegacyCapability[]).find((c) => c.id === id);
    if (legacy) legacy.grants.forEach((g) => out.add(g));
    else if (getToolDefinition(id)) out.add(id);
  }
  return [...out];
}

export type ToolAvailabilityReason = "ok" | "not_granted" | "planned" | "missing_config" | "autonomy_too_low" | "requires_approval";

export const TOOL_AVAILABILITY_LABELS: Record<ToolAvailabilityReason, string> = {
  ok: "Disponível",
  not_granted: "Não autorizada para este funcionário",
  planned: "Planejada — ainda não executável",
  missing_config: "Requer configuração no servidor",
  autonomy_too_low: "Nível de autonomia insuficiente",
  requires_approval: "Exige aprovação do proprietário a cada uso",
};

/**
 * Static authorization decision for one employee and one tool. The runtime re-checks it on every
 * call, plus input validation and usage limits.
 */
export function toolAvailability(
  toolId: string,
  ctx: { grants: readonly string[]; autonomyLevel: number; configuredEnv: (name: string) => boolean },
): ToolAvailabilityReason {
  const tool = getToolDefinition(toolId);
  if (!tool || !ctx.grants.includes(toolId)) return "not_granted";
  if (tool.status !== "available") return "planned";
  if (tool.requiresEnv?.some((e) => !ctx.configuredEnv(e))) return "missing_config";
  if (ctx.autonomyLevel < tool.riskLevel) return "autonomy_too_low";
  if (tool.riskLevel >= 4) return "requires_approval";
  return "ok";
}
