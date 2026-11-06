# Operations Engine v1.0: ferramentas, execução e operações de marketing

Regra deste documento: só aparece como "implementado" o que tem código executável e teste. Uma integração só aparece como "funcional" depois de uma chamada real.

## 1. Diagnóstico do estado real (antes desta etapa)

| Módulo pedido | Situação verificada no código |
| --- | --- |
| Command Center, departamentos, funcionários, tarefas, auditoria, escritório 3D | ✅ Existentes e testados. |
| Agent Runtime + provedores (Anthropic/OpenAI) | ✅ Existente (Central Brain v1, fases 1–2). Chamada a modelo **real** ainda não validada: falta cadastrar a chave de API na Vercel. |
| Aprovações | ✅ Existem, com vínculo por hash do conteúdo. ❌ "Solicitar alterações" não existe. ❌ Não há campos de risco ou impacto financeiro. |
| **Memória** | ❌ **Não implementada.** O agente é informado de que não tem memória. |
| **Central Brain (roteamento/delegação)** | ❌ Não implementado. O proprietário escolhe o funcionário. |
| Tool Registry | ❌ Havia só um catálogo declarativo, sem nada executável. |
| Projetos, Entregas, Pipeline, Meta Ads | ❌ Inexistentes. |
| Rede do ambiente de desenvolvimento | ⚠️ Sem acesso à internet (proxy bloqueia hosts externos). Testes de rede reais precisam rodar fora daqui (sandbox da Vercel ou produção). |

## 2. Plano técnico (fases)

| Fase | Conteúdo | Status |
| --- | --- | --- |
| 1. Tool Registry e permissões | Catálogo, níveis de autonomia 1–4, gateway de execução, limites, histórico, tool calling nos dois provedores | ✅ **Implementada** |
| 2. Pesquisa web e documentos | `web.fetch_page` ✅ (chamada real validada) · `web.search` ✅ código pronto, **aguarda chave** `BRAVE_SEARCH_API_KEY` · documentos e PDFs ⏳ (dependem da Fase 4: Projetos e arquivos) | ◐ Parcial |
| 3. Conteúdo e imagens | O texto já é produzido pelo próprio modelo. Imagens: provedor oficial (API de imagens da OpenAI) e armazenamento (Vercel Blob) | ⏳ |
| 4. Projetos e Central de Entregas | Entidades Projeto e Entrega (versões, status, histórico, arquivos, referências), vínculo com tarefas, conversas e aprovações | ⏳ |
| 5. Pipeline configurável | Modelos de pipeline salvos no banco (etapas → função/funcionário → dependências). O Central Brain cria as tarefas dependentes | ⏳ |
| 6. Meta Ads (somente consulta) | OAuth oficial, token cifrado no servidor, permissão `ads_read`, Marketing API (contas, campanhas, conjuntos, anúncios, insights). Antes de implementar, conferir a documentação atual da Meta | ⏳ |
| 7. Aprovações para ações externas | Ferramentas de nível 3 (preparar) e nível 4 (executar só com aprovação cujo hash confere). Novas ações "solicitar alterações", riscos e impacto financeiro | ⏳ |
| 8. Dashboard e observabilidade | Já existem: custos e tokens de IA, ferramentas mais usadas, histórico por ferramenta. Faltam indicadores de projetos e entregas (dependem da Fase 4) | ◐ Parcial |

## 3. O que a Fase 1 entregou

### Tool Registry (`packages/core/src/tools.ts`)

Cada ferramenta tem:
- identificador e nome;
- descrição;
- categoria;
- status (`available` ou `planned`);
- **nível de risco**, que é o nível mínimo de autonomia exigido;
- efeitos colaterais;
- permissões;
- limites por execução e por dia por funcionário;
- variáveis de ambiente exigidas (só os nomes).

Os parâmetros são validados com zod no handler (`packages/engine/src/tools/*`) e enviados ao modelo como JSON Schema.

| Ferramenta | Nível | Estado |
| --- | --- | --- |
| `web.fetch_page`: ler página pública | 1 | ✅ Disponível. Chamada real validada: example.com e wikipedia.org lidos; metadados de nuvem e localhost bloqueados. |
| `web.search`: Brave Search API | 1 | Código e testes prontos. Fica oculta até `BRAVE_SEARCH_API_KEY` ser configurada. **Sem chamada real ainda.** |
| `analytics.compute_metrics`: CTR, CPC, CPM, CPA, ROAS, conversão | 1 | ✅ Cálculo determinístico. Exige a origem dos dados e mostra fórmulas e entradas. |
| `tasks.lookup`: consultar tarefas e resultados | 1 | ✅ Somente leitura. |
| `docs.*`, `images.generate`, `dev.run_sandbox`, `meta_ads.*` | 1–4 | Planejadas. Nunca são oferecidas ao modelo. |

As autorizações antigas da FOUNDATION (por exemplo `research.market`) continuam valendo: equivalem às ferramentas concretas correspondentes. Nenhuma versão de funcionário foi reescrita.

### Níveis de autonomia
- O nível é guardado em `agents.autonomy_level` (padrão 2).
- Só um **usuário humano** com permissão `agents:write` altera o nível, e a alteração é auditada (`agent.autonomy_change`). Agentes não têm `agents:write`, então nenhum agente eleva as próprias permissões.
- Ferramentas de nível 4 exigem aprovação a cada uso e não são executáveis nesta fase.

### Gateway (`packages/engine/src/tools/gateway.ts`)

É o único caminho entre a chamada de um modelo e um handler. A cada chamada, ele:
1. verifica se a ferramenta existe;
2. relê o nível de autonomia **atual** do funcionário;
3. confere se a ferramenta está liberada para ele (concessão, status, configuração e nível);
4. aplica o limite por execução;
5. aplica o limite diário;
6. valida os parâmetros;
7. executa, com cancelamento;
8. registra tudo em `tool_executions`, inclusive as **recusas** e o motivo.

As fontes ficam em `research_sources`, com hash do conteúdo lido.

### Runtime com ferramentas
- O runtime faz um laço de até `AI_MAX_TOOL_ROUNDS` rodadas (padrão 6) de modelo → ferramentas → modelo.
- Tokens e custo são somados entre as rodadas.
- Na última rodada, o modelo é instruído a responder sem ferramentas.
- O resultado da tarefa lista as ferramentas usadas e as fontes.
- O prompt informa ao funcionário exatamente quais ferramentas estão disponíveis. Conteúdo externo chega delimitado e marcado como não confiável.

### Segurança da leitura de páginas
- Aceita só http(s) nas portas padrão, sem credenciais na URL.
- Resolve o DNS e recusa IPs privados, loopback, link-local, metadados de nuvem e multicast.
- Revalida cada redirecionamento (máximo 4).
- Limita a resposta a 2 MB e 15 s, e aceita só HTML ou texto.
- **Risco residual documentado:** a checagem de DNS e a conexão são passos separados, o que deixa uma janela teórica para *DNS rebinding*. Para fechá-la, seria preciso fixar o IP na conexão (agente HTTP próprio). Isso fica para quando houver uma dependência aprovada para esse fim.

### Telas
- **Ferramentas** (`/tools`): registro, status, níveis, limites, funcionários autorizados (com o motivo quando a ferramenta não está liberada), uso e histórico.
- **Funcionário:** seletor de nível de autonomia, acesso efetivo a cada ferramenta e últimas execuções.
- **Tarefa:** ferramentas utilizadas e fontes e referências.
- **Centro de Comando:** ferramentas mais usadas.

## 4. Testes
- `packages/ai`: tool calling Anthropic e OpenAI (envio das ferramentas, blocos `tool_use`/`tool_result`, parse das chamadas).
- `packages/engine/test/tools.test.ts`:
  - proteção contra SSRF;
  - extração de HTML;
  - leitura de página e redirecionamento para endereço interno;
  - busca (formato da chamada oficial);
  - métricas;
  - integração com o banco: ferramentas oferecidas, recusas (não autorizada, parâmetros inválidos, ferramenta inexistente), limite por execução, limite de rodadas, autonomia só alterável por humano e auditada.
- E2E: a funcionária usa `analytics.compute_metrics` via gateway com o servidor de teste da Anthropic, e o resultado, as ferramentas e os tokens somados aparecem na interface.
- Chamada real de `web.fetch_page` executada num sandbox da Vercel (Node 24, internet liberada) com o mesmo código, conferido pelo hash MD5 do arquivo.

## 5. Teste de aceitação ("campanha para produto digital de baixo ticket")

Ainda **não** é executável. Ele depende de Projetos, Entregas, Pipeline e Central Brain (Fases 4–5) e de uma chave de modelo real na Vercel.
