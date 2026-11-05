# Fluxo de Execução — Criação e Transição de Ticket

## 1. Criar um ticket — `POST /tickets`

```
{ "clientId": "client-123" }
```

### Sequência de arquivos chamados

```
1. src/main.ts
   └── ValidationPipe valida o body antes de chegar no controller

2. src/modules/ticket/interface/dto/ticket.dto.ts
   └── CreateTicketDto valida que clientId é string não vazia

3. src/modules/ticket/interface/ticket.controller.ts
   └── método create() recebe o DTO e chama ticketRepo.create()

4. src/modules/ticket/application/ports/ticket.repository.ts
   └── ITicketRepository.create() — contrato chamado pelo controller

5. src/modules/ticket/infra/persistence/ticket.prisma.repository.ts
   └── TicketPrismaRepository.create() — executa INSERT no banco
       currentState = CREATED (default do Prisma)

6. prisma/schema.prisma
   └── model Ticket — define a tabela e o default CREATED
```

**Resultado:** linha inserida na tabela `tickets` com `current_state = CREATED`

---

## 2. Disparar um evento — `POST /tickets/:id/events`

```
{ "event": "SPECIALIST_ASSIGNED" }
```

### Sequência de arquivos chamados

```
1. src/main.ts
   └── ValidationPipe valida o body

2. src/modules/ticket/interface/dto/ticket.dto.ts
   └── SendEventDto valida que event é um dos 6 valores válidos do array ticketSagaEvents

3. src/modules/ticket/interface/ticket.controller.ts
   └── método sendEvent() recebe id e DTO, chama stateMachine.execute()

4. src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts
   └── execute() — orquestra tudo:
       a. chama ticketRepo.findById(id)
       b. monta o TicketSagaContext com os dados do ticket
       c. instancia o TicketStateMachine com o estado atual
       d. chama machine.send(event)
       e. chama ticketRepo.updateState() com o novo estado
       f. chama eventRepo.save() com o log da transição

5. src/modules/ticket/application/ports/ticket.repository.ts
   └── ITicketRepository.findById() — busca o ticket (passo 4a)

6. src/modules/ticket/infra/persistence/ticket.prisma.repository.ts
   └── TicketPrismaRepository.findById() — SELECT no banco

7. src/modules/ticket/domain/ticket-saga.types.ts
   └── TicketSagaContext — shape do contexto montado com os dados do ticket

8. src/modules/ticket/domain/ticket-state-machine.ts
   └── TicketStateMachine.send(event):
       a. consulta this.transitions[currentState][event]
       b. se não existir → lança erro (transição inválida), nada é persistido
       c. muda currentState para o target
       d. executa a action correspondente
       e. se a action falhar → rollback do estado, lança erro

9. src/modules/ticket/application/ports/ticket.actions.ts
   └── TicketActions — interface da action executada (passo 8d)

10. src/modules/ticket/infra/actions/ticket.actions.ts
    └── ex: AssignSpecialistAction.execute() — stub com Logger por enquanto

11. src/modules/ticket/infra/persistence/ticket.prisma.repository.ts
    └── TicketPrismaRepository.updateState() — UPDATE current_state no banco (passo 4e)

12. src/modules/ticket/application/ports/ticket-saga-event.repository.ts
    └── ITicketSagaEventRepository.save() — contrato do log (passo 4f)

13. src/modules/ticket/infra/persistence/ticket-saga-event.prisma.repository.ts
    └── TicketSagaEventPrismaRepository.save() — INSERT na tabela ticket_saga_events

14. prisma/schema.prisma
    └── model TicketSagaEventLog — registra fromState, toState, triggeredBy, errorMessage
```

**Resultado:** `current_state` atualizado na tabela `tickets` + nova linha em `ticket_saga_events`

---

## Resumo visual

```
HTTP Request
    │
    ▼
ValidationPipe (main.ts)
    │
    ▼
TicketController (interface/)
    │
    ▼
TicketStateMachineUseCase (application/)
    │
    ├── findById ──────────────────▶ TicketPrismaRepository (infra/persistence)
    │                                        │
    │                                        ▼
    │                                     Postgres
    │
    ├── TicketStateMachine (domain/) ◀── monta contexto
    │       │
    │       └── action ────────────▶ AssignSpecialistAction (infra/actions) [stub]
    │
    ├── updateState ───────────────▶ TicketPrismaRepository (infra/persistence)
    │                                        │
    │                                        ▼
    │                                     Postgres
    │
    └── save ──────────────────────▶ TicketSagaEventPrismaRepository (infra/persistence)
                                             │
                                             ▼
                                          Postgres
```
