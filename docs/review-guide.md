# Code Review Guide — Ticket Saga (Etapas 1–3)

## TODO

- [ ] `src/modules/ticket/domain/ticket-saga.types.ts`
- [ ] `src/modules/ticket/domain/ticket-state-machine.ts`
- [ ] `src/modules/ticket/domain/__tests__/ticket-state-machine.spec.ts`
- [ ] `src/modules/ticket/application/ports/ticket.repository.ts`
- [ ] `src/modules/ticket/application/ports/ticket-saga-event.repository.ts`
- [ ] `src/modules/ticket/application/ports/ticket.actions.ts`
- [ ] `src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts`
- [ ] `src/modules/ticket/application/use-cases/__tests__/ticket-state-machine.use-case.spec.ts`
- [ ] `src/modules/ticket/infra/actions/ticket.actions.ts`
- [ ] `src/modules/ticket/infra/persistence/ticket.prisma.repository.ts`
- [ ] `src/modules/ticket/infra/persistence/ticket-saga-event.prisma.repository.ts`
- [ ] `src/modules/ticket/interface/dto/ticket.dto.ts`
- [ ] `src/modules/ticket/interface/ticket.controller.ts`
- [ ] `src/modules/ticket/ticket.module.ts`
- [ ] `src/main.ts`
- [ ] `src/app.module.ts`
- [ ] `prisma/schema.prisma`
- [ ] `prisma/migrations/20261105114736_init_ticket_saga/migration.sql`
- [ ] `docs/ticket-saga-flow.md`
- [ ] `docs/adrs/ADR-001-ticket-saga-state-machine.md`

---

## Domain — o coração, comece aqui

### `src/modules/ticket/domain/ticket-saga.types.ts`
- `TicketSagaState` — os 7 estados possíveis do ticket (`CREATED`, `ASSIGNED`, `ACCEPTED`, `REASSIGN`, `COMPLETED`, `NO_SURVEY`, `CLOSED`)
- `TicketSagaEvent` — os 6 gatilhos que causam transição de estado
- `TicketSagaContext` — dados que trafegam pela saga (`ticketId`, `clientId`, `specialistId?`, `errorMessage?`)

### `src/modules/ticket/domain/ticket-state-machine.ts`
- Classe pura, sem framework, sem I/O
- Recebe `initialState`, `context` e um objeto `actions` com os handlers de cada transição
- `this.transitions` — tabela completa de transições: estado atual → evento → `{ target, action }`
- `send(event, reason?)` — valida se a transição existe, muda o estado, executa a action; em caso de erro na action faz rollback do estado
- Pontos para avaliar:
  - A tabela de transições está correta conforme o fluxo documentado em `docs/ticket-saga-flow.md`?
  - O rollback em caso de falha na action faz sentido pro seu cenário?

### `src/modules/ticket/domain/__tests__/ticket-state-machine.spec.ts`
- 19 testes sem NestJS, sem banco, sem I/O
- Cobre: happy path completo, caminho de reassign, caminho de no_survey, 9 transições inválidas, rollback de estado, propagação do `reason`

---

## Application — orquestração

### `src/modules/ticket/application/ports/ticket.repository.ts`
- `TicketEntity` — shape do ticket retornado pelo repositório
- `ITicketRepository` — contrato com `create`, `findById`, `updateState`
- `TICKET_REPOSITORY` — token de injeção
- O domínio depende dessa interface, nunca da implementação concreta

### `src/modules/ticket/application/ports/ticket-saga-event.repository.ts`
- `TicketSagaEventEntity` — shape do log de transição
- `ITicketSagaEventRepository` — contrato com `save`
- `TICKET_SAGA_EVENT_REPOSITORY` — token de injeção

### `src/modules/ticket/application/ports/ticket.actions.ts`
- `ITicketAction` — interface com `execute(ctx): Promise<void>`
- `TicketActions` — mapa com as 6 actions nomeadas
- `TICKET_ACTIONS` — token de injeção
- Decisão: use case recebe um objeto único `TicketActions` ao invés de 6 dependências separadas

### `src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts`
- Recebe `ITicketRepository`, `ITicketSagaEventRepository` e `TicketActions` via injeção
- Fluxo: busca o ticket → monta o contexto → instancia a máquina → dispara o evento → persiste o novo estado → salva o log de transição
- Se o ticket não existir lança `NotFoundException`
- Se a transição for inválida lança erro e **não persiste nada**

### `src/modules/ticket/application/use-cases/__tests__/ticket-state-machine.use-case.spec.ts`
- 4 testes com mocks dos repositórios e actions
- Cobre: ticket não encontrado, transição com persistência, propagação do `reason`, transição inválida sem persistência

---

## Infra — stubs por enquanto

### `src/modules/ticket/infra/actions/ticket.actions.ts`
- 6 classes `@Injectable()`, cada uma implementa `ITicketAction`
- Por enquanto só fazem `Logger.log` — serão substituídas pelas chamadas reais (HTTP, fila, etc.) nas próximas etapas
- Implementam a interface `ITicketAction` definida no port

---

## Banco

### `prisma/schema.prisma`
- Enum `TicketSagaState` — espelho dos estados do domínio
- Enum `TicketSagaEvent` — espelho dos eventos do domínio
- Model `Ticket` — `currentState` default `CREATED`, `specialistId` nullable
- Model `TicketSagaEventLog` — log imutável de cada transição com `fromState`, `toState`, `triggeredBy`, `errorMessage?`
- FK de `TicketSagaEventLog` → `Ticket`

### `prisma/migrations/20261105114736_init_ticket_saga/migration.sql`
- SQL gerado pelo Prisma — vale conferir os tipos (`UUID`, `TIMESTAMPTZ`, `VARCHAR(50)`)

---

## Docs

### `docs/ticket-saga-flow.md`
- Diagrama ASCII do fluxo completo
- Tabela de transições: estado atual + evento + próximo estado + descrição
- Tabela de estados: descrição + se é terminal
- Notas de comportamento dos casos especiais

### `docs/adrs/ADR-001-ticket-saga-state-machine.md`
- Por que saga orquestrada com máquina de estado
- Distinção entre `TicketSagaState` (onde está) e `TicketSagaEvent` (o que aconteceu)
- Por que a state machine não foi isolada em módulo próprio
- Comportamento eventual do `NO_SURVEY`
