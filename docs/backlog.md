# Backlog de Tarefas

Tarefas identificadas durante o desenvolvimento que foram adiadas intencionalmente. Cada item contém contexto suficiente para um dev implementar sem precisar perguntar.

---

## [TASK-001] Job de Reconciliação de Tickets Presos em CREATED

**Contexto**

Com a atribuição de especialista sendo assíncrona via RabbitMQ (ver ADR-003), existe uma janela de falha: se o serviço de assignment estiver fora do ar ou a mensagem se perder, o ticket fica preso no estado `CREATED` indefinidamente sem que ninguém perceba.

O job de reconciliação é a rede de segurança que detecta esses tickets e republica o evento de atribuição automaticamente.

**O que deve ser feito**

1. Adicionar campo `retryCount Int @default(0)` no model `Ticket` do `prisma/schema.prisma` e rodar `prisma migrate dev`

2. Atualizar `TicketEntity` em `src/modules/ticket/domain/ticket.repository.ts` adicionando `retryCount: number`

3. Adicionar método `findStuckInCreated(thresholdMinutes: number): Promise<TicketEntity[]>` na interface `ITicketRepository` — deve retornar tickets com `currentState = CREATED` e `updatedAt < now - thresholdMinutes`

4. Implementar o método em `src/modules/ticket/infra/persistence/ticket.prisma.repository.ts`

5. Criar o use case `src/modules/ticket/application/use-cases/reconcile-stuck-tickets.use-case.ts` com a seguinte lógica:
   - Busca tickets presos via `findStuckInCreated(thresholdMinutes)`
   - Para cada ticket com `retryCount < MAX_RETRIES`: republica `ticket.assignment.requested` via `IAssignmentEventPublisher` e incrementa `retryCount`
   - Para cada ticket com `retryCount >= MAX_RETRIES`: loga um alerta estruturado (por enquanto só log — notificação real é escopo futuro)
   - `MAX_RETRIES` e `thresholdMinutes` devem vir de variáveis de ambiente com fallback (`MAX_RETRIES=5`, `STUCK_TICKET_THRESHOLD_MINUTES=10`)

6. Instalar `@nestjs/schedule` e adicionar o `ScheduleModule.forRoot()` no `AppModule`

7. Criar `src/modules/ticket/application/use-cases/reconcile-stuck-tickets.cron.ts` — um `@Injectable()` com `@Cron(CronExpression.EVERY_5_MINUTES)` que chama o use case. Separar o cron do use case mantém o use case testável sem depender do decorator

8. Registrar o cron e o use case no `ticket.module.ts`

**Testes esperados**

Arquivo: `src/modules/ticket/application/use-cases/__tests__/reconcile-stuck-tickets.use-case.spec.ts`

Casos mínimos:
- Republica evento para tickets presos com `retryCount < MAX_RETRIES`
- Incrementa `retryCount` após republicar
- Não republica para tickets com `retryCount >= MAX_RETRIES`
- Não faz nada se não houver tickets presos
- Loga alerta quando ticket atinge `MAX_RETRIES`

**Referências**
- ADR-003: `docs/adrs/ADR-003-async-specialist-assignment-via-rabbitmq.md`
- Port do publisher: `IAssignmentEventPublisher` em `src/modules/ticket/domain/ticket.actions.ts`
- Padrão de use case existente: `src/modules/ticket/application/use-cases/create-ticket.use-case.ts`
- Padrão de repositório existente: `src/modules/ticket/infra/persistence/ticket.prisma.repository.ts`

---

## [TASK-002] Criar o Serviço de Assignment (easy.ticket.assignment)

**Contexto**

O orquestrador publica o evento `ticket.assignment.requested` na exchange `ticket.management` (tipo `topic`) do RabbitMQ sempre que um ticket é criado ou precisa ser reatribuído. O Serviço de Assignment é o consumidor desse evento — ele é responsável por encontrar um especialista disponível e publicar de volta o evento `ticket.assignment.completed`.

Esse serviço ainda não existe e precisa ser criado do zero.

**Stack esperada**

Seguir o mesmo padrão do orquestrador: NestJS + Prisma + `@golevelup/nestjs-rabbitmq`. Estrutura de módulos por bounded context (ver project-rules do orquestrador como referência).

**Mensageria**

| Exchange | Tipo | Routing key | Ação |
|---|---|---|---|
| `ticket.management` | topic | `ticket.assignment.requested` | **consumir** — recebe o pedido de atribuição |
| `ticket.management` | topic | `ticket.assignment.completed` | **publicar** — notifica o orquestrador com o resultado |

Configuração do consumer (equivalente ao que o orquestrador faz no listener):
```
exchange: ticket.management
routingKey: ticket.assignment.requested
queue: assignment.service.ticket.management
queueOptions: { durable: true }
```

Payload recebido em `ticket.assignment.requested`:
```json
{ "ticketId": "string" }
```

Payload a publicar em `ticket.assignment.completed`:
```json
{ "ticketId": "string", "specialistId": "string" }
```

**O que deve ser feito**

1. Criar o repositório `easy.ticket.assignment` com a estrutura base do NestJS (`nest new` ou copiar o scaffold do orquestrador)

2. Criar o módulo `assignment` seguindo a estrutura:
```
src/modules/assignment/
├── domain/
│   ├── specialist.entity.ts         ← entidade do especialista
│   ├── specialist.repository.ts     ← interface do repositório
│   └── assignment.types.ts          ← tipos do domínio
├── application/
│   └── use-cases/
│       └── assign-specialist.use-case.ts
├── infra/
│   ├── persistence/
│   │   └── specialist.prisma.repository.ts
│   └── messaging/
│       ├── assignment-requested.listener.ts  ← consome ticket.assignment.requested
│       └── assignment-completed.publisher.ts ← publica ticket.assignment.completed
└── assignment.module.ts
```

3. Modelar o `Specialist` no Prisma com os campos mínimos:
   - `id`, `name`, `available: Boolean`, `createdAt`, `updatedAt`

4. Implementar o `AssignSpecialistUseCase`:
   - Recebe o `ticketId`
   - Busca um especialista disponível no banco (**regra de negócio a definir** — ver seção abaixo)
   - Se encontrar: publica `ticket.assignment.completed { ticketId, specialistId }`
   - Se não encontrar: loga e não publica — o job de reconciliação do orquestrador vai retentar (ver TASK-001)

5. Implementar o listener `AssignmentRequestedListener` com `@RabbitSubscribe`:
   - Consome `ticket.assignment.requested`
   - Chama `AssignSpecialistUseCase.execute(ticketId)`

6. Implementar o publisher `AssignmentCompletedPublisher`:
   - Publica na exchange `ticket.management` com routing key `ticket.assignment.completed`

7. Adicionar variáveis de ambiente:
   - `DATABASE_URL` — connection string do banco próprio do serviço
   - `RABBITMQ_URL` — mesma URL do orquestrador (mesma instância RabbitMQ)
   - `PORT` — porta HTTP (sugerido: `3003`)

**Regra de atribuição de especialista — a definir**

A lógica para encontrar o especialista ainda não foi decidida. Algumas opções a discutir com o time antes de implementar:

- **Round-robin** — atribui ao próximo especialista disponível em ordem circular
- **Menor carga** — atribui ao especialista com menos tickets ativos no momento
- **Aleatório entre disponíveis** — sorteia entre os especialistas com `available = true`
- **Por especialidade** — o ticket carrega uma categoria e o especialista tem skills cadastradas

A implementação deve ser isolada em uma classe de domínio (ex: `SpecialistAssignmentStrategy`) para facilitar a troca da estratégia sem alterar o use case.

**Testes esperados**

- `assign-specialist.use-case.spec.ts`:
  - Publica `assignment.completed` quando encontra especialista disponível
  - Não publica quando não há especialista disponível
  - Loga quando não há especialista disponível

- `assignment-requested.listener.spec.ts`:
  - Chama o use case com o `ticketId` correto ao receber o evento
  - Propaga erro se o use case lançar

- `assignment-completed.publisher.spec.ts`:
  - Publica na exchange correta com a routing key correta

**Referências**
- Padrão de publisher/listener do orquestrador: `src/modules/ticket/infra/messaging/`
- ADR-003 do orquestrador: `docs/adrs/ADR-003-async-specialist-assignment-via-rabbitmq.md`
- Exchange e filas já declaradas pelo orquestrador: `ticket.management` (topic)
