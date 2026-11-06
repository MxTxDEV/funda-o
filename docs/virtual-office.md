# Escritório Virtual 3D

Rota: `/office` (item **Escritório Virtual** na navegação lateral).
Ambiente 3D real (React Three Fiber + Three.js), interativo e alimentado exclusivamente pelos dados do sistema.

## Ambientes

| Sala | Posição | Conteúdo |
| --- | --- | --- |
| Central Brain | centro | plataforma circular, núcleo holográfico animado (velocidade/brilho = atividade real: tarefas executando e fila), consoles |
| Diretoria | fundo, centro | mesa executiva, cadeira, monitores, telas de indicadores com números reais (aprovações pendentes, tarefas ativas) |
| Estratégia & Pesquisa, Ofertas & Copywriting, Design & Criativos, Funis & Desenvolvimento, Tráfego & Performance | salas de departamento | paredes de vidro, estações de trabalho, funcionários reais sentados |
| Sala de Reuniões | frente, centro | mesa, 8 cadeiras, tela; "nenhuma reunião ativa" (não há reuniões no sistema ainda) |
| Sala de Lazer | frente, direita | sofás, TV, mesa de jogo; funcionários **pausados** descansam aqui |

## Dados (fonte única: banco atual)

- `GET /api/v1/office` → `getOfficeSnapshot()` (`packages/core/src/services/office.ts`), consultado a cada 5 s com a aba visível.
- **Sala do departamento:** tabela `department_office_zones` (migração `0003_office_zones`). Sem registro, a sala é escolhida
  automaticamente pelo nome (palavras-chave) e depois pelas salas livres, sem gravar nada. Quem tem `departments:write` pode mover
  um departamento de sala pelo painel (troca de salas se ocupada; ação auditada como `department.office_zone`).
- **Estação de trabalho:** derivada da ordem de cadastro dos funcionários do departamento (sem coordenadas duplicadas no banco).
  Até 12 estações por sala; excedentes aparecem no painel e na barra inferior.
- **Status no escritório** (`deriveOfficeStatus`, `packages/core/src/office.ts`), sempre a partir de dados reais:

| Status | Origem |
| --- | --- |
| Em execução de tarefa | presença `working` (tarefa em andamento) |
| Trabalhando | disponível, mas com tarefa(s) na fila |
| Disponível | ativo, sem trabalho em curso |
| Aguardando aprovação | presença `waiting_approval` |
| Em descanso | funcionário pausado (vai para a sala de lazer) |
| Em comunicação | **reservado** para o Central Brain — nunca exibido hoje |

## Interação

- Clique em funcionário, sala ou Central Brain (raycasting). O seletor "Ir para ambiente…" e a barra inferior são alternativas acessíveis por teclado.
- Painel do funcionário: avatar, cargo, departamento, especialidade, status, tarefa atual, últimas atividades (eventos reais),
  ferramentas autorizadas, **Abrir conversa** (abre ou cria a conversa individual no módulo existente; ação explícita do usuário),
  **Ver perfil**, **Nova tarefa**. Selecionar não executa nenhuma ação.
- Painel do departamento: descrição, funcionários, tarefas ativas, disponíveis, link para a página do departamento, troca de sala.
- Câmera: girar/mover/zoom com mouse, botões de zoom, giro, centralizar, visão inicial e enquadramento automático da seleção.

## Arquitetura (`apps/web/src/components/office`)

```
VirtualOffice.tsx            raiz cliente: polling, WebGL/fallback, painéis, estado vazio
use-office-data.ts           polling + detecção de WebGL
store.ts                     zustand: seleção, comandos de câmera, qualidade (sem dados de negócio)
layout.ts                    posições derivadas do snapshot (salas, mesas, lazer, enquadramento)
OfficeTopBar / OfficeStatusBar / OfficeControls
panels/                      EmployeeDetailsPanel, DepartmentDetailsPanel, RoomPanels (Brain/Diretoria/Reuniões/Lazer)
scene/VirtualOfficeCanvas    Canvas, PerformanceMonitor, AdaptiveDpr (carregado sob demanda)
scene/OfficeScene            composição da cena
scene/OfficeCamera           OrbitControls + animações de câmera
scene/OfficeLighting, OfficeStructure, RoomShell, DepartmentArea, EmployeeStation,
      EmployeeCharacter, CentralBrainObject, FixedRooms (Diretoria, Reuniões, Lazer)
scene/shared.ts              geometrias e materiais compartilhados (trocar por assets profissionais aqui)
```

## Performance

- three.js só é baixado na página `/office` (`next/dynamic`, `ssr: false`), com estado de carregamento.
- Geometria procedural; geometrias unitárias e materiais reutilizados por todas as instâncias.
- `PerformanceMonitor`: se o FPS cair, reduz o pixel ratio e desliga animações de personagens e do núcleo; o usuário também pode alternar
  a qualidade manualmente. O render loop é pausado pelo navegador com a aba oculta, e o polling só roda com a aba visível.
- Sem WebGL: planta 2D existente, com aviso.

## Segurança

Leitura exige `dashboard:read`; mudar sala exige `departments:write`; abrir conversa exige `conversations:write`. Tudo no backend,
auditado. Nenhum dado fictício: salas sem departamento aparecem como tal, reuniões e "Em comunicação" são sinalizados como recursos futuros.
