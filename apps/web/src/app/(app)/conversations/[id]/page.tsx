import { can, CONVERSATION_KIND_LABELS, getConversation } from "@vc/core";
import { Archive, Info, Send } from "lucide-react";
import { AgentAvatar } from "@/components/agent-avatar";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { handlePageError } from "@/lib/page-errors";
import { getServiceContext } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { archiveConversationAction, postMessageAction } from "../../actions/conversations";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getServiceContext();
  const conv = await getConversation(ctx, id).catch(handlePageError);
  const canWrite = can(ctx.actor, "conversations:write") && !conv.archivedAt;

  return (
    <>
      <AutoRefresh intervalMs={8000} />
      <PageHeader
        eyebrow={CONVERSATION_KIND_LABELS[conv.kind]}
        title={conv.title}
        actions={
          <>
            {conv.archivedAt && <Badge>Arquivada</Badge>}
            {canWrite && (
              <ActionForm action={archiveConversationAction} confirm="Arquivar esta conversa?">
                <input type="hidden" name="conversationId" value={conv.id} />
                <SubmitButton size="sm" variant="outline">
                  <Archive /> Arquivar
                </SubmitButton>
              </ActionForm>
            )}
          </>
        }
      />
      <div className="mb-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-[#9dbbff]">
        <Info className="mt-0.5 size-4 shrink-0" />
        Infraestrutura de conversas ativa. Os funcionários virtuais ainda não respondem: as respostas serão geradas pelo Central Brain em uma fase futura.
        Nenhuma resposta é simulada.
      </div>
      <Card className="flex h-[calc(100dvh-300px)] min-h-[420px] flex-col">
        <CardContent className="flex-1 space-y-4 overflow-y-auto">
          {conv.messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
          {conv.messages.map((m) => (
            <div key={m.id} className={m.authorType === "user" ? "flex justify-end" : "flex justify-start gap-2"}>
              {m.authorType === "agent" && conv.agent && <AgentAvatar seed={conv.agent.avatarSeed} url={conv.agent.avatarUrl} name={conv.agent.name} size={28} />}
              <div
                className={
                  m.authorType === "user"
                    ? "max-w-[75%] rounded-lg rounded-br-sm bg-primary/90 px-3 py-2 text-sm text-white"
                    : "max-w-[75%] rounded-lg rounded-bl-sm border border-border bg-surface-2 px-3 py-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className="mt-1 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</p>
              </div>
            </div>
          ))}
        </CardContent>
        {canWrite && (
          <div className="border-t border-border p-3">
            <ActionForm action={postMessageAction} className="flex items-end gap-2" resetOnSuccess>
              <input type="hidden" name="conversationId" value={conv.id} />
              <Textarea name="content" required maxLength={5000} placeholder="Escreva uma mensagem…" className="min-h-11 flex-1" aria-label="Mensagem" />
              <SubmitButton size="icon" aria-label="Enviar">
                <Send />
              </SubmitButton>
            </ActionForm>
          </div>
        )}
      </Card>
    </>
  );
}
