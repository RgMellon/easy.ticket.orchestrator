# ADR-004 — Histórico de Reconciliação em Tabela Separada

**Status:** Aceito

## Contexto

O job de reconciliação (TASK-001) precisa rastrear quantas vezes um ticket preso em `CREATED` foi retentado, para saber quando parar de republicar e emitir um alerta.

A abordagem inicial (descrita no ADR-003) era adicionar um campo `retryCount Int @default(0)` diretamente no model `Ticket`. Antes de implementar, avaliamos se essa era a modelagem correta.

## Decisão

O `retryCount` **não** será adicionado ao model `Ticket`. Em vez disso, será criada uma tabela separada `TicketReconciliationLog`.

```
TicketReconciliationLog
  id           UUID PK
  ticketId     UUID FK → Ticket.id
  attemptNumber Int
  retriedAt    Timestamptz
  reason       String   (ex: "stuck_in_created")
```

O `retryCount` efetivo é derivado contando os registros dessa tabela para um dado `ticketId`.

### Motivação

`retryCount` é um dado **operacional/infraestrutura** — não representa nenhuma regra de negócio do ticket. O model `Ticket` já carrega o estado da saga (`currentState`) e o log de transições (`TicketSagaEventLog`). Adicionar `retryCount` ali misturaria responsabilidades:

- `Ticket` → estado de negócio da saga
- `TicketSagaEventLog` → auditoria de transições de negócio
- `TicketReconciliationLog` → histórico operacional de tentativas de recuperação

Separado, o log de reconciliação pode evoluir independentemente — adicionar `failedAt`, `errorMessage`, `notifiedAt` sem tocar no modelo principal.

## Consequências

- O model `Ticket` permanece limpo, com apenas dados de negócio
- O job de reconciliação tem sua própria tabela com histórico completo de tentativas
- O `retryCount` é calculado via `COUNT` na tabela de log — sem campo derivado para manter sincronizado
- A interface `ITicketRepository` **não** recebe `findStuckInCreated` — essa responsabilidade vai para um repositório próprio `IReconciliationRepository`, mantendo o repositório de ticket focado no ciclo de vida da saga
