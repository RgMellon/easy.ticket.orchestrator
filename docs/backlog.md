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
