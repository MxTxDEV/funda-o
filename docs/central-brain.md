# Central Brain v1.0: execução real dos agentes

Este documento registra o diagnóstico técnico, a arquitetura implementada e o estado de cada fase.
A regra deste documento: só aparece como implementado o que tem código executável e teste.

## 1. Diagnóstico técnico (antes desta etapa)

| Área | Situação encontrada |
| --- | --- |
| Tarefas | Máquina de 7 estados (`pending → queued → in_progress → waiting_approval/completed/failed/cancelled`), concorrência otimista (`version`), eventos por tarefa, idempotência de criação (`idempotencyKey`). |
| Fila | BullMQ com job id determinístico `(taskId, runNumber)`, backoff exponencial, reconciliador, worker dedicado **ou** modo `serverless` (drain com lock Redis dentro da função da Vercel). |
| Execução | Só existia o processador **de demonstração** (`demo.lifecycle`). Nenhuma chamada de IA. |
| Funcionários | Versões imutáveis com `instructions`, `allowedTools`, `aiProvider`, `aiModel` (texto livre, sem validação) e `config` (vazio, reservado). |
| Ferramentas | Catálogo declarativo (`tools.ts`), todas com status `planned`, nenhuma executável. |
| Aprovações | Concorrência otimista; ao aprovar, a tarefa volta à fila. **Não havia vínculo com o conteúdo aprovado.** |
| Presença | `working` derivado de tarefa `in_progress` (isto é, quando o worker de fato pegou a tarefa), não da simples atribuição. |
| Memória / delegação | Inexistentes. |
| Lacunas críticas | Sem provedores de IA, sem registro de consumo/custo, sem limites, sem vínculo hash da aprovação, campo de modelo aceitava qualquer texto. |

## 2. Arquitetura (componentes separados)

```
packages/ai            Model Provider Registry (sem banco, sem segredos no código)
  catalog.ts           ids/rótulos de provedores, schema de configuração por funcionário (client-safe)
  providers/*.ts       Anthropic (Messages API) e OpenAI (Chat Completions), via fetch
  registry.ts          lê credenciais do ambiente; expõe apenas booleanos "configurado"
  pricing.ts / limits.ts  preços configuráveis (AI_MODEL_PRICING) e limites da empresa

packages/core
  services/agent-registry.ts  Agent Registry: identidade operacional da VERSÃO despachada
  services/ai.ts              status dos provedores, teste de conexão, lista oficial de modelos
  services/agent-runs.ts      registro de execuções (tokens, custo, duração, erros, uso diário)
  services/task-runs.ts       Task Orchestrator (já existia) + vínculo de aprovação por hash
  services/approvals.ts       Approval Manager (já existia)

packages/engine
  runtime/prompt.ts           identidade + regras invioláveis + tarefa como dado delimitado
  runtime/agent-runtime.ts    Agent Runtime: limites → chamada → registro → resultado
  processors/agent-execute.ts processador do tipo de tarefa `agent.execute`
```

Ainda **não implementados** (fases seguintes): Memory Service, Tool Registry executável e roteamento/delegação do Central Brain.

### Fluxo de uma tarefa `agent.execute`

1. O proprietário cria a tarefa e escolhe o funcionário. A versão atual do funcionário fica gravada na tarefa (`agentVersionId`).
2. A tarefa entra na fila (BullMQ). O worker, ou o drain serverless, a move para `in_progress`. Só a partir daí o funcionário aparece como "trabalhando".
3. O runtime carrega a identidade **da versão despachada**. Uma edição posterior das instruções não afeta essa execução.
4. O runtime verifica os limites: kill switch, limite diário de tokens e de custo da empresa, e limite diário do funcionário.
5. O runtime registra `agent_runs` (`running`) de forma idempotente por `(tarefa, execução, tentativa)`, com o hash do prompt.
6. O runtime chama o provedor com timeout. Ele consulta o cancelamento a cada 2 s e aborta a requisição HTTP se a tarefa for cancelada.
7. O runtime grava tokens, custo estimado (somente com preço configurado), duração, motivo de parada e id da requisição.
8. O resultado vai para `tasks.result`. Se o proprietário pediu aprovação, a tarefa fica em `waiting_approval` e a aprovação guarda o **hash do conteúdo**.
9. Na retomada após a aprovação, o runtime confere o hash. Se o conteúdo mudou, a tarefa falha e exige nova aprovação, e **o modelo não é chamado de novo**.

### Erros e retentativas

| Tipo | Tratamento |
| --- | --- |
| 429, 5xx, 529, timeout, rede | Retentativa com backoff da fila. Cada tentativa vira uma linha em `agent_runs`. |
| 401, 403, 404, 400, sem credencial, limite atingido, sem modelo configurado | Falha permanente (`UnrecoverableError`), sem gastar tentativas. |
| Cancelamento | Requisição abortada. A execução fica registrada como `aborted`. |

## 3. Segurança

* As chaves existem só como variáveis de ambiente do servidor (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). Banco, interface, API e auditoria recebem só `configured: true/false`. As mensagens de erro passam por um redator de padrões `sk-…`.
* Não há modelos inventados. A lista de modelos válidos vem do endpoint de listagem do próprio provedor (botão "Verificar conexão"). Se existe uma lista verificada, um modelo fora dela é recusado ao salvar a versão.
* Não há preços inventados. O custo só é estimado com `AI_MODEL_PRICING`; sem preço, a interface mostra "sem preço".
* O conteúdo da tarefa vai para o modelo dentro de `<tarefa>…</tarefa>`, como dado. Tags que poderiam fechar o envelope são neutralizadas. As regras invioláveis ficam no prompt de sistema: nada de gastar, publicar, pagar, comprar, comunicar externamente ou executar ações irreversíveis, e separar fatos, hipóteses e sugestões.
* O agente é informado de que **não** tem internet, ferramentas nem memória nesta fase, e de que não pode afirmar ter pesquisado.

## 4. Configuração (produção na Vercel)

1. Em Vercel → Project → Settings → Environment Variables, cadastre `ANTHROPIC_API_KEY` e/ou `OPENAI_API_KEY` (escopo Production).
2. Opcional: `AI_MODEL_PRICING` (JSON), `AI_DAILY_TOKEN_LIMIT`, `AI_DAILY_COST_LIMIT_USD` e `AI_REQUEST_TIMEOUT_MS`.
3. Faça um novo deploy.
4. No sistema, abra **IA e execuções** e clique em **Verificar conexão e atualizar modelos**.
5. Em **Funcionários → Sophia → Nova versão**, escolha o provedor e um modelo da lista e salve.
6. Em **Tarefas → Nova tarefa**, escolha o tipo "Execução por IA" e a responsável Sophia, e crie a tarefa.

## 5. Estado das fases

| Fase | Status | Evidência |
| --- | --- | --- |
| 1. Infraestrutura de IA e provedores | ✅ implementada | `packages/ai` + 13 testes unitários (formato das requisições, uso, erros, timeout, cancelamento, redação de segredos) |
| 2. Agent Runtime e execução de tarefas | ✅ implementada | 10 testes de integração com Postgres/Redis reais e provedor falso injetado; E2E com servidor HTTP que imita a API da Anthropic |
| Validação com modelo **real** | ⏳ depende da chave | Não há chave de API neste ambiente de desenvolvimento. O fluxo completo foi validado ponta a ponta contra um servidor de teste HTTP. A chamada real será validada quando a chave estiver cadastrada na Vercel. |
| 3. Memória (individual, departamental, central) | ⏳ próxima | Avaliação de pgvector: o Neon suporta a extensão `vector`. Ainda não implementada. |
| 4. Tool Registry executável | ⏳ | O catálogo existe, mas nenhuma ferramenta está conectada (o agente é informado disso). |
| 5. Central Brain (roteamento e delegação) | ⏳ | Hoje o proprietário escolhe o funcionário. O encaminhamento automático ainda não existe. |
| 6. Colaboração entre agentes | ⏳ | — |
| 7. Integração visual e observabilidade | ◐ parcial | Página "IA e execuções", card no Centro de Comando, execuções por funcionário e por tarefa, execução ativa no escritório 3D, API `/api/v1/ai` e `/api/v1/ai/runs`. |
