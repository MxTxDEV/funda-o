import { assertCan, listAuditLogs } from "@vc/core";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getServiceContext } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Auditoria" };

const ENTITY_TYPES = ["department", "agent", "task", "approval", "conversation", "user", "system"];
const ENTITY_LINKS: Record<string, string> = {
  department: "/departments/",
  agent: "/agents/",
  task: "/tasks/",
  approval: "/approvals/",
  conversation: "/conversations/",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entityType?: string; action?: string; page?: string }> }) {
  const sp = await searchParams;
  const ctx = await getServiceContext();
  assertCan(ctx.actor, "audit:read");
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 50;
  const entityType = ENTITY_TYPES.includes(sp.entityType ?? "") ? sp.entityType : undefined;
  const { items, total } = await listAuditLogs(ctx, { entityType, action: sp.action, limit, offset: (page - 1) * limit });
  const pages = Math.max(1, Math.ceil(total / limit));
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (entityType) q.set("entityType", entityType);
    if (sp.action) q.set("action", sp.action);
    q.set("page", String(p));
    return `/audit?${q}`;
  };

  return (
    <>
      <PageHeader eyebrow="Segurança" title="Auditoria" description="Registro imutável (append-only) de todas as operações relevantes." />
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <Select name="entityType" defaultValue={entityType ?? ""} className="w-48" aria-label="Entidade">
          <option value="">Todas as entidades</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input name="action" defaultValue={sp.action ?? ""} placeholder="Ação (prefixo, ex.: task.)" className="w-64" maxLength={80} />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Quando</TH>
                <TH>Ator</TH>
                <TH>Ação</TH>
                <TH>Entidade</TH>
                <TH>Detalhes</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TD>
                  <TD className="text-xs">
                    <Badge tone={l.actorType === "user" ? "blue" : "neutral"}>{l.actorType}</Badge> {l.actorLabel}
                  </TD>
                  <TD className="font-mono text-xs">{l.action}</TD>
                  <TD className="text-xs">
                    {l.entityId && ENTITY_LINKS[l.entityType] ? (
                      <Link className="text-primary hover:underline" href={`${ENTITY_LINKS[l.entityType]}${l.entityId}`}>
                        {l.entityType}
                      </Link>
                    ) : (
                      l.entityType
                    )}
                  </TD>
                  <TD className="max-w-md">
                    <code className="line-clamp-2 break-all text-[11px] text-muted-foreground">
                      {JSON.stringify({ ...l.changes, ...l.metadata })}
                    </code>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum registro.</p>}
        </CardContent>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} registros · página {page}/{pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)}>Anterior</Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)}>Próxima</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
