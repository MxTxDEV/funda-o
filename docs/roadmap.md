# Limitações conhecidas e próximas etapas

## Limitações conhecidas (FOUNDATION v1.0)

1. **Sem motor de IA.** O único processador é `demo.lifecycle` (marcado como DEMO na UI e no
   resultado). Funcionários não respondem nas conversas — nenhuma resposta é simulada.
2. **Ferramentas apenas declaradas.** O catálogo existe e é autorizado por versão, mas nenhuma
   ferramenta executa nada. Publicação de anúncios e gastos estão fora do escopo por design.
3. **Gestão de usuários só por CLI** (`pnpm db:seed:admin`). Papéis admin/operator/viewer existem e
   são aplicados, mas não há tela de convite/edição de usuários nem 2FA.
4. **API apenas com sessão de navegador.** Não há tokens de API para integrações máquina-a-máquina.
5. **Atualização "ao vivo" por polling** (`router.refresh` a cada 2,5–8 s), não por WebSocket/SSE.
6. **Escritório 2D provisório** — o escritório 3D é uma fase futura (`agent_presence.location` reservado).
7. **Worker fora da Vercel:** exige um host de containers (Railway/Render/Fly/VPS).
8. **Rate limit em janela fixa** e fail-closed: se o Redis cair, login e mutações ficam indisponíveis.
9. **CSP com `'unsafe-inline'`** em scripts (necessário para o Next sem nonces). Endurecer com nonces.
10. **Sem ESLint** configurado (o Next 16 removeu `next lint`); a qualidade é garantida por
    TypeScript strict e testes.
11. Imagens Docker não foram construídas neste ambiente (sem daemon); ver relatório de testes.
12. Interface somente em português e tema escuro único.

## Próximas etapas recomendadas

1. **CI verde no GitHub** e deploy de *staging* (Vercel Preview + Neon branch + Redis separado +
   worker), executando o E2E contra a URL publicada.
2. **Central Brain v0:** cliente de LLM no worker, primeiro processador real (ex.: pesquisa de
   mercado ou copywriting) usando `agentVersion.instructions`, com custo/tokens registrados em
   `task_events` e aprovação humana obrigatória do resultado.
3. **Execução de ferramentas** com sandbox, limites e auditoria por chamada; manter publicação e
   gastos bloqueados até existir política de aprovação financeira explícita.
4. **Gestão de usuários e segurança:** telas de usuários/papéis, 2FA (TOTP), tokens de API com
   escopos, rotação de sessão, alertas de login.
5. **Tempo real:** SSE para eventos de tarefa e presença (substituir polling).
6. **Conversas inteligentes:** respostas do agente via Central Brain, com contexto do departamento.
7. **Observabilidade:** logs estruturados enviados a um coletor, métricas da fila (Bull Board ou
   painel próprio), alertas para worker offline e falhas repetidas.
8. **Integração Meta Ads (somente leitura primeiro)**, com segredos por conexão criptografados.
9. **Escritório 3D** (React Three Fiber) alimentado por `agent_presence`.
