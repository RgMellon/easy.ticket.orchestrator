# ADR-001 — Saga Orquestrada com Máquina de Estado para o Ticket

**Status:** Aceito

## Contexto

O ciclo de vida de um ticket envolve múltiplas etapas sequenciais com atores distintos (cliente, especialista, sistema de pesquisa). Algumas etapas podem falhar ou ficar em espera (sem especialista disponível, serviço de pesquisa indisponível). Precisávamos de uma forma de modelar esse fluxo que fosse auditável, resiliente a falhas parciais e fácil de evoluir.

## Decisão

Modelamos o ciclo de vida do ticket como uma **saga orquestrada** controlada por uma **máquina de estado finita**.

- `TicketSagaState` representa *onde o ticket está* — é o estado persistido no banco (`CREATED`, `ASSIGNED`, `ACCEPTED`, `REASSIGN`, `COMPLETED`, `NO_SURVEY`, `CLOSED`)
- `TicketSagaEvent` representa *o que aconteceu* para causar a transição — é o gatilho (`SPECIALIST_ASSIGNED`, `TICKET_ROUTED`, etc.)
- A tabela de transições define explicitamente quais eventos são válidos em cada estado, lançando erro em qualquer tentativa de transição inválida
- Em caso de falha na action de uma transição, o estado é revertido ao anterior (rollback in-memory)
- O log de cada transição (`fromState`, `toState`, `triggeredBy`, `errorMessage`) é persistido para auditoria completa

A saga é **síncrona na maior parte do fluxo**, com exceção do envio de pesquisa (`COMPLETED → CLOSED`), que é tolerante a falha — se falhar, o ticket vai para `NO_SURVEY` sem retornar erro ao usuário, e o retry é tratado de forma eventual.

A state machine **não foi isolada em módulo próprio** porque no easy.ticket ela *é* o ticket — não existe ciclo de vida do ticket separado da saga. Qualquer mudança de regra afeta os dois simultaneamente, o que tornaria a separação um limite artificial (ver project-rules: "Quando NÃO separar em módulos").

## Consequências

- O fluxo completo é auditável via tabela de eventos da saga
- Transições inválidas são detectadas em tempo de execução com mensagem clara
- Adicionar um novo estado ou evento exige alterar apenas `ticket-saga.types.ts` e `ticket-state-machine.ts`
- O estado `NO_SURVEY` introduz consistência eventual controlada — o ticket está funcionalmente encerrado mas a pesquisa pode chegar depois
- A máquina de estado é pura (sem I/O, sem framework), o que a torna 100% testável em isolamento
