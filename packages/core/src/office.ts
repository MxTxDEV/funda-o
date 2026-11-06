/**
 * Virtual office (3D) — static layout definitions shared by the server and the client.
 * The department data itself always comes from the database; this only describes the rooms.
 */
export const DEPARTMENT_ZONES = [
  {
    key: "strategy",
    label: "Estratégia & Pesquisa",
    responsibilities: ["Pesquisa de mercado", "Análise de concorrentes", "Identificação de oportunidades", "Pesquisa de público", "Planejamento estratégico"],
    keywords: ["estratégia", "estrategia", "pesquis", "intelig", "mercado", "research"],
  },
  {
    key: "offers",
    label: "Ofertas & Copywriting",
    responsibilities: ["Criação de ofertas", "Copywriting", "Headlines", "Roteiros", "Argumentos de venda", "Mecanismos de conversão"],
    keywords: ["oferta", "copy", "redação", "redacao", "conteud"],
  },
  {
    key: "design",
    label: "Design & Criativos",
    responsibilities: ["Criativos publicitários", "Imagens", "Vídeos", "Identidade visual", "Anúncios", "Variações para testes"],
    keywords: ["design", "criativ", "criação", "criacao", "arte", "visual", "video"],
  },
  {
    key: "funnels",
    label: "Funis & Desenvolvimento",
    responsibilities: ["Landing pages", "Páginas de vendas", "Quizzes", "Integrações", "Automações", "Ferramentas"],
    keywords: ["funil", "funis", "desenv", "dev", "tecnolog", "automa", "landing"],
  },
  {
    key: "traffic",
    label: "Tráfego & Performance",
    responsibilities: ["Meta Ads", "Planejamento de campanhas", "Análise de CPA", "Análise de ROAS", "Testes", "Otimização de campanhas"],
    keywords: ["tráfego", "trafego", "perform", "ads", "mídia", "midia", "campanha"],
  },
  {
    key: "executive",
    label: "Diretoria",
    responsibilities: ["Coordenação dos departamentos", "Distribuição de demandas", "Acompanhamento de tarefas", "Relatórios ao proprietário", "Decisões e aprovações (proprietário)"],
    keywords: ["diretoria", "direção", "direcao", "executiv", "gestão", "gestao", "operaç", "operac"],
  },
] as const;

export type DepartmentZoneKey = (typeof DEPARTMENT_ZONES)[number]["key"];
export const DEPARTMENT_ZONE_KEYS = DEPARTMENT_ZONES.map((z) => z.key) as [DepartmentZoneKey, ...DepartmentZoneKey[]];

export function getDepartmentZone(key: string) {
  return DEPARTMENT_ZONES.find((z) => z.key === key);
}

/** Best zone for a department name, or null when no keyword matches (specific areas win over "Diretoria"). */
export function matchZoneByName(name: string): DepartmentZoneKey | null {
  const n = name.toLowerCase();
  for (const zone of DEPARTMENT_ZONES) if (zone.keywords.some((k) => n.includes(k))) return zone.key;
  return null;
}

export { AI_CONNECTION_LABELS, type AiConnection, aiConnectionOf } from "@vc/ai/catalog";

/**
 * Places departments in rooms: explicit assignments first, then name matching, then free rooms in
 * creation order. Departments beyond the available rooms are returned as unplaced.
 */
export function resolveDepartmentZones(
  departments: { id: string; name: string; createdAt: Date | string }[],
  assigned: Map<string, string>,
): { placement: Map<string, { zone: DepartmentZoneKey; source: "assigned" | "auto" }>; unplaced: string[] } {
  const placement = new Map<string, { zone: DepartmentZoneKey; source: "assigned" | "auto" }>();
  const used = new Set<string>();
  for (const d of departments) {
    const z = assigned.get(d.id);
    if (z && DEPARTMENT_ZONE_KEYS.includes(z as DepartmentZoneKey) && !used.has(z)) {
      placement.set(d.id, { zone: z as DepartmentZoneKey, source: "assigned" });
      used.add(z);
    }
  }
  const pending = [...departments]
    .filter((d) => !placement.has(d.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const stillPending: typeof pending = [];
  for (const d of pending) {
    const m = matchZoneByName(d.name);
    if (m && !used.has(m)) {
      placement.set(d.id, { zone: m, source: "auto" });
      used.add(m);
    } else stillPending.push(d);
  }
  const unplaced: string[] = [];
  for (const d of stillPending) {
    const free = DEPARTMENT_ZONE_KEYS.find((k) => !used.has(k));
    if (!free) {
      unplaced.push(d.id);
      continue;
    }
    placement.set(d.id, { zone: free, source: "auto" });
    used.add(free);
  }
  return { placement, unplaced };
}

/**
 * Status shown in the office, derived only from real data:
 * - executing: presence "working" (a task is in progress)
 * - awaiting_approval: presence "waiting_approval"
 * - working: tasks queued, waiting for execution (shown as "Tarefa na fila", NOT as working)
 * - available: active, nothing assigned in flight
 * - resting: agent paused (shown in the lounge)
 * - communicating: reserved for the Central Brain integration (never produced today)
 */
export const OFFICE_STATUSES = ["executing", "working", "available", "communicating", "awaiting_approval", "resting"] as const;
export type OfficeStatus = (typeof OFFICE_STATUSES)[number];

export const OFFICE_STATUS_LABELS: Record<OfficeStatus, string> = {
  executing: "Em execução de tarefa",
  working: "Tarefa na fila",
  available: "Disponível",
  communicating: "Em comunicação",
  awaiting_approval: "Aguardando aprovação",
  resting: "Em descanso",
};

export const OFFICE_STATUS_COLORS: Record<OfficeStatus, string> = {
  executing: "#3d7bff",
  working: "#22d3ee",
  available: "#22c55e",
  communicating: "#a78bfa",
  awaiting_approval: "#f5a524",
  resting: "#8792a5",
};

export function deriveOfficeStatus(input: {
  agentStatus: "active" | "paused" | "archived";
  presence: "offline" | "idle" | "working" | "waiting_approval" | "paused" | null | undefined;
  queuedTasks: number;
}): OfficeStatus {
  if (input.agentStatus === "paused" || input.presence === "paused") return "resting";
  if (input.presence === "working") return "executing";
  if (input.presence === "waiting_approval") return "awaiting_approval";
  if (input.queuedTasks > 0) return "working";
  return "available";
}
