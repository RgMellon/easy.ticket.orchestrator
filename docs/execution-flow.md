# Fluxo de Execução — Criação e Transição de Ticket

## 1. Criar um ticket — `POST /tickets`

```
{ "clientId": "client-123" }
```

### Sequência de arquivos chamados

```
1. src/modules/ticket/interface/ticket.controller.ts
   └── create() recebe o DTO e chama createTicket.execute()

2. src/modules/ticket/application/use-cases/create-ticket.use-case.ts
   └── execute():
       a. chama TicketServiceHttpClient.createTicket(clientId)   ← HTTP pro Serviço de Ticket
       b. recebe { ticketId }
       c. chama ticketRepo.create({ ticketId, clientId })        ← salva contexto da saga
       d. chama AssignmentServiceHttpClient.assignSpecialist()   ← HTTP pro Serviço de Atribuição
       e. recebe { specialistId }
       f. chama stateMachine.execute(ticketId, SPECIALIST_ASSIGNED, specialistId)
       g. chama stateMachine.execute(ticketId, TICKET_ROUTED)

3. src/modules/ticket/infra/clients/ticket-service.http-client.ts
   └── POST {TICKET_SERVICE_URL}/tickets

4. src/modules/ticket/infra/clients/assignment-service.http-client.ts
   └── POST {ASSIGNMENT_SERVICE_URL}/assignments
       TODO: tratar falha de atribuição (nenhum especialista disponível)

5. src/modules/ticket/infra/persistence/ticket.prisma.repository.ts
   └── create() — INSERT na tabela tickets com ticketId externo e currentState = CREATED
```

**Resultado:** linha inserida em `tickets` com `current_state = CREATED`, depois transicionada para `ACCEPTED` via `SPECIALIST_ASSIGNED` → `TICKET_ROUTED`

---

## 2. Concluir um ticket — `POST /tickets/:id/events { event: REPAIR_COMPLETED }`

### Sequência de arquivos chamados

```
1. src/modules/ticket/interface/ticket.controller.ts
   └── sendEvent() chama stateMachine.execute(ticketId, REPAIR_COMPLETED)

2. src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts
   └── execute():
       a. findByTicketId(ticketId)
       b. monta TicketSagaContext
       c. instancia TicketStateMachine com estado atual
       d. machine.send(REPAIR_COMPLETED) → ACCEPTED → COMPLETED
       e. updateState(COMPLETED)
       f. eventRepo.save({ ACCEPTED → COMPLETED })
       g. chama sendSurvey() internamente

3. src/modules/ticket/domain/ticket-state-machine.ts
   └── send(REPAIR_COMPLETED):
       a. executa RepairCompletedAction

4. src/modules/ticket/infra/actions/ticket.actions.ts — RepairCompletedAction
   └── chama TicketServiceHttpClient.completeTicket(ticketId)   ← HTTP síncrono pro Serviço de Ticket
       Serviço de Ticket atualiza banco + publica na fila de analytics (transparente pro orquestrador)

5. src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts — sendSurvey()
   └── tenta machine.send(SURVEY_SENT):
       ✓ sucesso:
           - SurveySentAction → SurveyServiceHttpClient.sendSurvey()  ← HTTP síncrono pro Serviço de Pesquisa
           - updateState(CLOSED)
           - eventRepo.save({ COMPLETED → CLOSED })
           - retorna { to: CLOSED }
       ✗ falha:
           - machine.send(SURVEY_FAILED)
           - SurveyFailedAction → loga (fila de retry pendente)
           - updateState(NO_SURVEY)
           - eventRepo.save({ COMPLETED → NO_SURVEY })
           - retorna { to: NO_SURVEY }  ← sem erro pro app móvel
```

**Resultado:** ticket em `CLOSED` (caso feliz) ou `NO_SURVEY` (falha na pesquisa). App móvel sempre recebe resposta.

---

## Resumo visual — fluxo de conclusão

```
App móvel
    │ POST /tickets/:id/events { REPAIR_COMPLETED }
    ▼
TicketController
    │
    ▼
TicketStateMachineUseCase
    │
    ├── findByTicketId ──────────────▶ TicketPrismaRepository ──▶ Postgres
    │
    ├── TicketStateMachine.send(REPAIR_COMPLETED)
    │       └── RepairCompletedAction
    │               └── TicketServiceHttpClient ──▶ Serviço de Ticket
    │                                                    └── publica analytics (assíncrono)
    │
    ├── updateState(COMPLETED) ──────▶ Postgres
    ├── eventRepo.save() ────────────▶ Postgres
    │
    └── sendSurvey()
            ├── [sucesso] SurveySentAction
            │       └── SurveyServiceHttpClient ──▶ Serviço de Pesquisa
            │               └── salva + envia e-mail
            │
            └── [falha] SurveyFailedAction
                    └── loga (retry via fila — pendente)
    │
    ▼
App móvel recebe resposta (CLOSED ou NO_SURVEY)
```
