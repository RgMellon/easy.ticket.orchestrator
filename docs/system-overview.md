# System Overview — easy.ticket

Visão geral dos três microserviços, seus contratos e status de implementação. Documento de referência rápida — atualizar sempre que um contrato ou status mudar.

---

## Microserviços

| Serviço | Porta | Repositório |
|---|---|---|
| `easy.ticket.orchestrator` | `3000` | Orquestra a saga do ticket |
| `easy.ticket.service` | `3001` | CRUD do ticket (dados do negócio) |
| `easy.ticket.assignment` | `3003` | Atribuição de especialista |

Infraestrutura compartilhada: RabbitMQ (`amqp://localhost:5672`), cada serviço tem seu próprio Postgres.

---

## Fluxo completo de criação de ticket

```
App Móvel
  │
  │ POST /tickets { clientId }
  ▼
easy.ticket.orchestrator
  │
  ├─► POST /tickets { clientId }  ──►  easy.ticket.service
  │                                        retorna { id, name, status, ... }
  │   usa só data.id como ticketId
  │
  ├─► Postgres (orchestrator): INSERT ticket { ticketId, clientId, state: CREATED }
  │
  └─► RabbitMQ publish: ticket.assignment.requested { ticketId }
        │
        ▼
  easy.ticket.assignment  (consome ticket.assignment.requested)
        │
        ├─► delay aleatório 20s–60s (simulando busca de especialista)
        │
        └─► RabbitMQ publish: ticket.assignment.completed { ticketId, specialistId }
              │
              ▼
  easy.ticket.orchestrator  (consome ticket.assignment.completed)
        │
        └─► stateMachine.execute(ticketId, SPECIALIST_ASSIGNED, specialistId)
              CREATED → ASSIGNED
```

---

## Fluxo completo de conclusão de ticket

```
App Móvel
  │
  │ POST /tickets/:id/events { event: TICKET_ROUTED }
  ▼
orchestrator: ASSIGNED → ACCEPTED  (RouteTicketAction — stub, só loga)

  │
  │ POST /tickets/:id/events { event: REPAIR_COMPLETED }
  ▼
orchestrator: ACCEPTED → COMPLETED
  ├─► PATCH /tickets/:ticketId/complete  ──►  easy.ticket.service
  └─► tenta enviar pesquisa automaticamente (sendSurvey)

  ├─ sucesso:  COMPLETED → CLOSED      (SurveySentAction — stub, só loga)
  └─ falha:    COMPLETED → NO_SURVEY   (SurveyFailedAction — stub, só loga)
```

---

## Contratos HTTP

### easy.ticket.service

| Método | Rota | Body | Retorno |
|---|---|---|---|
| `POST` | `/tickets` | `{ clientId, name?, description? }` | `{ id, name, description, clientId, status, createdAt, completedAt }` |
| `GET` | `/tickets/:id` | — | `{ id, name, description, clientId, status, createdAt, completedAt }` |
| `PATCH` | `/tickets/:id/complete` | — | `{ id, name, description, clientId, status, createdAt, completedAt }` |

> O orchestrator chama `POST /tickets` passando só `{ clientId }` — `name` é gerado pelo service (`EAS-XXXXX`).
> O orchestrator usa apenas `data.id` da resposta.

### easy.ticket.orchestrator

| Método | Rota | Body | Retorno |
|---|---|---|---|
| `POST` | `/tickets` | `{ clientId }` | `{ id, ticketId, clientId, currentState, createdAt, updatedAt }` |
| `POST` | `/tickets/:id/events` | `{ event, specialistId?, reason? }` | `{ ticketId, from, to }` |
| `POST` | `/internal/tickets/:id/simulate/assignment-requested` | — | — (dev only) |

---

## Contratos de Mensageria (RabbitMQ)

Exchange: `ticket.management` (tipo `topic`) — declarada por ambos os serviços.

| Routing Key | Publicado por | Consumido por | Payload |
|---|---|---|---|
| `ticket.assignment.requested` | orchestrator | assignment | `{ ticketId }` |
| `ticket.assignment.completed` | assignment | orchestrator | `{ ticketId, specialistId }` |

**Filas:**
- `assignment.service.ticket.management` — consumer do assignment
- `orchestrator.ticket.management` — consumer do orchestrator

---

## Status de Implementação

### Fluxos funcionais ✅

| Fluxo | Detalhe |
|---|---|
| Criar ticket | orchestrator → ticket.service → RabbitMQ → assignment → RabbitMQ → orchestrator |
| Atribuir especialista | contrato de mensageria completo, `specialistId` é `randomUUID()` com delay 20–60s |
| Concluir reparo | `REPAIR_COMPLETED` chama `PATCH /tickets/:id/complete` no ticket.service ✅ |

### Stubs / incompletos ⚠️

| Componente | Arquivo | Status |
|---|---|---|
| `RouteTicketAction` | `infra/actions/route-ticket.action.ts` | Só loga — não notifica especialista |
| `SurveySentAction` | `infra/actions/survey-sent.action.ts` | Só loga — `SurveyServiceHttpClient` existe mas não é usado |
| `SurveyFailedAction` | `infra/actions/survey-failed.action.ts` | Só loga |
| `ReassignRequestedAction` | `infra/actions/reassign-requested.action.ts` | Só loga — não republica `ticket.assignment.requested` no RabbitMQ |
| `AssignSpecialistUseCase` | `assignment/use-cases/assign-specialist.use-case.ts` | `specialistId` é `randomUUID()`, sem banco real |

### Backlog pendente

| Task | Descrição |
|---|---|
| TASK-001 | Job de reconciliação de tickets presos em `CREATED` |
| TASK-002 | Lógica real de seleção de especialista no assignment (banco + estratégia) |
| TASK-003 | Campo `resolutionNote` no evento da saga |

---

## Máquina de Estados (resumo)

| De | Evento | Para | Action |
|---|---|---|---|
| `CREATED` | `SPECIALIST_ASSIGNED` | `ASSIGNED` | `AssignSpecialistAction` (stub) |
| `ASSIGNED` | `TICKET_ROUTED` | `ACCEPTED` | `RouteTicketAction` (stub) |
| `ACCEPTED` | `REPAIR_COMPLETED` | `COMPLETED` | `RepairCompletedAction` → chama ticket.service ✅ |
| `ACCEPTED` | `REASSIGN_REQUESTED` | `REASSIGN` | `ReassignRequestedAction` (stub) |
| `REASSIGN` | `SPECIALIST_ASSIGNED` | `ASSIGNED` | `AssignSpecialistAction` (stub) |
| `COMPLETED` | `SURVEY_SENT` | `CLOSED` | `SurveySentAction` (stub) |
| `COMPLETED` | `SURVEY_FAILED` | `NO_SURVEY` | `SurveyFailedAction` (stub) |
| `NO_SURVEY` | `SURVEY_SENT` | `CLOSED` | `SurveySentAction` (stub) |

---

## Arquivos-chave por responsabilidade

| Responsabilidade | Arquivo |
|---|---|
| Criar ticket (orchestrator) | `src/modules/ticket/application/use-cases/create-ticket.use-case.ts` |
| Máquina de estados | `src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts` |
| Lógica pura de transições | `src/modules/ticket/domain/ticket-state-machine.ts` |
| Tipos da saga (estados/eventos) | `src/modules/ticket/domain/ticket-saga.types.ts` |
| Publisher RabbitMQ (orchestrator) | `src/modules/ticket/infra/messaging/assignment-event.publisher.ts` |
| Listener RabbitMQ (orchestrator) | `src/modules/ticket/infra/messaging/assignment-event.listener.ts` |
| Publisher RabbitMQ (assignment) | `src/modules/assignment/infra/messaging/assignment-completed.publisher.ts` |
| Listener RabbitMQ (assignment) | `src/modules/assignment/infra/messaging/assignment-requested.listener.ts` |
| Atribuição de especialista | `src/modules/assignment/application/use-cases/assign-specialist.use-case.ts` |
| HTTP client → ticket.service | `src/modules/ticket/infra/clients/ticket-service.http-client.ts` |
| HTTP client → survey.service | `src/modules/ticket/infra/clients/survey-service.http-client.ts` |
