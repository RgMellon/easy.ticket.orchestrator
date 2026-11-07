# Fluxo de Execução — Criação e Transição de Ticket

## 1. Criar um ticket — `POST /tickets`

### Fluxo síncrono — criação e publicação do evento

```mermaid
sequenceDiagram
    actor App as App Móvel
    participant C as TicketController
    participant UC as CreateTicketUseCase
    participant TS as TicketService (HTTP)
    participant DB as Postgres
    participant MQ as RabbitMQ<br/>ticket.management

    App->>C: POST /tickets { clientId }
    C->>UC: execute(clientId)

    UC->>TS: createTicket(clientId)
    TS-->>UC: { ticketId }

    UC->>DB: create({ ticketId, clientId, state: CREATED })
    DB-->>UC: TicketEntity

    UC->>MQ: publish(ticket.assignment.requested, { ticketId })

    UC-->>C: TicketEntity { state: CREATED }
    C-->>App: 201 { ticketId, currentState: CREATED }
```

> O cliente recebe resposta imediatamente com o ticket em `CREATED`. A atribuição do especialista acontece de forma assíncrona.

---

### Fluxo assíncrono — atribuição de especialista

```mermaid
sequenceDiagram
    participant MQ as RabbitMQ<br/>ticket.management
    participant AS as Serviço de Assignment
    participant L as AssignmentEventListener
    participant UC as TicketStateMachineUseCase
    participant SM as TicketStateMachine
    participant DB as Postgres

    MQ->>AS: ticket.assignment.requested { ticketId }
    AS->>AS: processa atribuição
    AS->>MQ: ticket.assignment.completed { ticketId, specialistId }

    MQ->>L: ticket.assignment.completed
    L->>UC: execute(ticketId, SPECIALIST_ASSIGNED, specialistId)

    UC->>DB: findByTicketId(ticketId)
    DB-->>UC: Ticket { state: CREATED }

    UC->>SM: send(SPECIALIST_ASSIGNED)
    SM->>SM: AssignSpecialistAction
    SM-->>UC: state: ASSIGNED

    UC->>DB: updateState(ASSIGNED, specialistId)
    UC->>DB: eventRepo.save(CREATED → ASSIGNED)
```

---

## 2. Concluir um ticket — `POST /tickets/:id/events`

```mermaid
sequenceDiagram
    actor App as App Móvel
    participant C as TicketController
    participant UC as TicketStateMachineUseCase
    participant SM as TicketStateMachine
    participant TS as TicketService (HTTP)
    participant SS as SurveyService (HTTP)
    participant DB as Postgres

    App->>C: POST /tickets/:id/events { event: REPAIR_COMPLETED }
    C->>UC: execute(ticketId, REPAIR_COMPLETED)

    UC->>DB: findByTicketId(ticketId)
    DB-->>UC: Ticket { state: ACCEPTED }

    UC->>SM: send(REPAIR_COMPLETED)
    SM->>TS: completeTicket(ticketId)
    TS-->>SM: ok
    SM-->>UC: state: COMPLETED

    UC->>DB: updateState(COMPLETED)
    UC->>DB: eventRepo.save(ACCEPTED → COMPLETED)

    UC->>SM: send(SURVEY_SENT)

    alt Pesquisa enviada com sucesso
        SM->>SS: sendSurvey(ticketId, clientId)
        SS-->>SM: ok
        SM-->>UC: state: CLOSED
        UC->>DB: updateState(CLOSED)
        UC->>DB: eventRepo.save(COMPLETED → CLOSED)
        UC-->>C: { to: CLOSED }
    else Falha no serviço de pesquisa
        SM-->>UC: erro
        UC->>SM: send(SURVEY_FAILED)
        SM-->>UC: state: NO_SURVEY
        UC->>DB: updateState(NO_SURVEY)
        UC->>DB: eventRepo.save(COMPLETED → NO_SURVEY)
        UC-->>C: { to: NO_SURVEY }
    end

    C-->>App: 200 { from, to }
```

> Em caso de falha na pesquisa, o ticket vai para `NO_SURVEY` e o app móvel recebe resposta normalmente — sem erro. O retry da pesquisa é tratado de forma eventual.
