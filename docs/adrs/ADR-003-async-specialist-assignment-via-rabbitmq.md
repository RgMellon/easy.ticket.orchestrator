# ADR-003 — Atribuição de Especialista Assíncrona via RabbitMQ

**Status:** Aceito

## Contexto

A atribuição de especialista era feita de forma síncrona dentro do `CreateTicketUseCase`: após criar o ticket, o orquestrador chamava o serviço de assignment via HTTP e aguardava a resposta antes de retornar ao cliente.

Isso introduzia dois problemas:

1. **Acoplamento temporal** — se o serviço de assignment estivesse indisponível, a criação do ticket falhava inteiramente, mesmo o ticket já tendo sido criado no Serviço de Ticket
2. **Latência desnecessária** — o cliente aguardava o tempo de atribuição para receber a confirmação de criação

## Decisão

A atribuição de especialista passa a ser **assíncrona via RabbitMQ**.

### Fluxo

1. O orquestrador cria o ticket (estado `CREATED`) e publica o evento `ticket.assignment.requested` na exchange `ticket.management`
2. O serviço de assignment consome esse evento, processa a atribuição e publica `ticket.assignment.completed` na mesma exchange
3. O orquestrador tem um listener que consome `ticket.assignment.completed` e dispara a transição `SPECIALIST_ASSIGNED` na máquina de estado

O cliente recebe o ticket em `CREATED` imediatamente, sem aguardar a atribuição.

### Estrutura de exchanges

Adotamos **bounded exchanges** — uma exchange por contexto de comunicação, não por fluxo:

| Exchange | Tipo | Contexto |
|---|---|---|
| `ticket.management` | topic | Atribuição e ciclo de vida do ticket |

Exchanges futuras (ex: `ticket.survey`) serão criadas quando os respectivos fluxos forem implementados. Isso permite aplicar políticas independentes (DLQ, TTL, retry) por contexto sem impacto cruzado.

### Routing keys

| Routing key | Publicado por | Consumido por |
|---|---|---|
| `ticket.assignment.requested` | Orquestrador | Serviço de Assignment |
| `ticket.assignment.completed` | Serviço de Assignment | Orquestrador |

### Resiliência — job de reconciliação

Tickets que permanecerem em `CREATED` por mais de X minutos sem transição são considerados presos. Um cron job periódico:

1. Busca tickets em `CREATED` com `updatedAt < agora - threshold`
2. Republica o evento `ticket.assignment.requested` para cada um
3. Registra a tentativa em `TicketReconciliationLog` (ver ADR-004)
4. Ao atingir `MAX_RETRIES` (contado via registros no log), emite alerta estruturado

Isso garante recuperação automática de falhas transitórias no serviço de assignment, independente do broker.

### Modelagem no domínio

A publicação de eventos é abstraída como um port `IAssignmentEventPublisher` no domínio, com implementação concreta em `infra/`. O `AssignmentServiceHttpClient` existente é removido — substituído pelo publisher RabbitMQ.

## Consequências

- O ticket é sempre criado, independente da disponibilidade do serviço de assignment
- O orquestrador passa a ser simultaneamente publisher e listener na exchange `ticket.management`
- A consistência entre criação e atribuição passa a ser **eventual** — o estado `CREATED` é visível ao cliente por um breve período
- Tickets presos são recuperados automaticamente pelo job de reconciliação, com fallback para alerta manual após `MAX_RETRIES`
- A troca de transporte (ex: SQS no lugar de RabbitMQ) exige apenas substituir a implementação concreta em `infra/`, sem tocar em domínio ou use cases
