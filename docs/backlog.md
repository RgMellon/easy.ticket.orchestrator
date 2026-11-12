# Backlog de Tarefas

Tarefas identificadas durante o desenvolvimento que foram adiadas intencionalmente. Cada item contém contexto suficiente para um dev implementar sem precisar perguntar.

---

## [TASK-001] Job de Reconciliação de Tickets Presos em CREATED

**Contexto**

Com a atribuição de especialista sendo assíncrona via RabbitMQ (ver ADR-003), existe uma janela de falha: se o serviço de assignment estiver fora do ar ou a mensagem se perder, o ticket fica preso no estado `CREATED` indefinidamente sem que ninguém perceba.

O job de reconciliação é a rede de segurança que detecta esses tickets e republica o evento de atribuição automaticamente.

O histórico de tentativas é armazenado em tabela separada `TicketReconciliationLog` — não no model `Ticket` — pois `retryCount` é dado operacional, não de negócio (ver ADR-004).

**O que deve ser feito**

1. Adicionar model `TicketReconciliationLog` no `prisma/schema.prisma` e rodar `prisma migrate dev`:
   ```prisma
   model TicketReconciliationLog {
     id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     ticketId      String   @map("ticket_id") @db.Uuid
     attemptNumber Int      @map("attempt_number")
     retriedAt     DateTime @default(now()) @map("retried_at") @db.Timestamptz
     reason        String

     ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

     @@map("ticket_reconciliation_logs")
   }
   ```

2. Criar a interface `IReconciliationRepository` em `src/modules/ticket/domain/reconciliation.repository.ts`:
   - `findStuckInCreated(thresholdMinutes: number): Promise<TicketEntity[]>` — tickets com `currentState = CREATED` e `updatedAt < now - thresholdMinutes`
   - `countAttempts(ticketId: string): Promise<number>` — conta registros em `TicketReconciliationLog` para o ticket
   - `saveAttempt(ticketId: string, attemptNumber: number, reason: string): Promise<void>` — persiste a tentativa

3. Implementar `ReconciliationPrismaRepository` em `src/modules/ticket/infra/persistence/reconciliation.prisma.repository.ts`

4. Criar o use case `src/modules/ticket/application/use-cases/reconcile-stuck-tickets.use-case.ts` com a seguinte lógica:
   - Busca tickets presos via `findStuckInCreated(thresholdMinutes)`
   - Para cada ticket: conta tentativas via `countAttempts(ticketId)`
   - Se `attempts < MAX_RETRIES`: republica `ticket.assignment.requested` via `IAssignmentEventPublisher` e salva tentativa via `saveAttempt`
   - Se `attempts >= MAX_RETRIES`: loga alerta estruturado (por enquanto só log — notificação real é escopo futuro)
   - `MAX_RETRIES` e `thresholdMinutes` devem vir de variáveis de ambiente com fallback (`MAX_RETRIES=5`, `STUCK_TICKET_THRESHOLD_MINUTES=10`)

5. Instalar `@nestjs/schedule` e adicionar o `ScheduleModule.forRoot()` no `AppModule`

6. Criar `src/modules/ticket/application/use-cases/reconcile-stuck-tickets.cron.ts` — um `@Injectable()` com `@Cron(CronExpression.EVERY_5_MINUTES)` que chama o use case. Separar o cron do use case mantém o use case testável sem depender do decorator

7. Registrar o cron, o use case e o repositório no `ticket.module.ts`

**Testes esperados**

Arquivo: `src/modules/ticket/application/use-cases/__tests__/reconcile-stuck-tickets.use-case.spec.ts`

Casos mínimos:
- Republica evento para tickets presos com `attempts < MAX_RETRIES`
- Salva tentativa em `TicketReconciliationLog` após republicar
- Não republica para tickets com `attempts >= MAX_RETRIES`
- Não faz nada se não houver tickets presos
- Loga alerta quando ticket atinge `MAX_RETRIES`

**Referências**
- ADR-003: `docs/adrs/ADR-003-async-specialist-assignment-via-rabbitmq.md`
- ADR-004: `docs/adrs/ADR-004-reconciliation-log-separate-table.md`
- Port do publisher: `IAssignmentEventPublisher` em `src/modules/ticket/domain/actions/assignment-event.publisher.ts`
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

---

## [TASK-003] Adicionar Campo `resolutionNote` no Evento da Saga

**Contexto**

Hoje o `TicketSagaContext` tem um campo `errorMessage` que é usado para registrar o motivo de transições problemáticas (ex: `REASSIGN_REQUESTED`). Existe a necessidade de também registrar uma nota de resolução quando o especialista conclui o reparo (ex: "problema era no cabo de alimentação"), mas usar `errorMessage` para isso é semanticamente incorreto — não se trata de um erro.

**O que deve ser feito**

1. Adicionar `resolutionNote?: string` em `TicketSagaContext` em `src/modules/ticket/domain/ticket-saga.types.ts`

2. Adicionar campo `resolutionNote String?` no model `TicketSagaEvent` em `prisma/schema.prisma` e rodar `prisma migrate dev`

3. Atualizar a interface `ITicketSagaEventRepository` e o model de persistência para incluir o campo

4. Adicionar `resolutionNote?: string` no `SendEventDto` em `src/modules/ticket/interface/dto/ticket.dto.ts` com `@IsOptional() @IsString()`

5. Passar o `resolutionNote` do DTO para o use case e populá-lo no contexto antes de executar a transição `REPAIR_COMPLETED`

6. Persistir o `resolutionNote` ao salvar o evento da saga no `TicketStateMachineUseCase`

**Referências**
- `src/modules/ticket/domain/ticket-saga.types.ts`
- `src/modules/ticket/interface/dto/ticket.dto.ts`
- `src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts`
- `prisma/schema.prisma`

---

## [TASK-004] Validar Implementação do `completeTicket` no Serviço de Ticket

**Contexto**

O orquestrador chama `PATCH /tickets/:id/complete` no Serviço de Ticket via `TicketServiceHttpClient.completeTicket()` quando o evento `REPAIR_COMPLETED` é processado. Antes de considerar esse fluxo funcional end-to-end, é necessário validar se o serviço de ticket já tem essa rota implementada e se o banco de dados dele está preparado para suportar a mudança de status.

**O que deve ser validado**

1. O Serviço de Ticket expõe `PATCH /tickets/:id/complete`
2. Essa rota atualiza o status do ticket para "concluído" no banco
3. O banco do Serviço de Ticket tem a tabela de tickets com o campo de status e os valores necessários para representar "em andamento" e "concluído"
4. O contrato de resposta da rota é compatível com o que o orquestrador espera (atualmente ignora o body da resposta — só valida que não lançou erro)

**Referências**
- `src/modules/ticket/infra/clients/ticket-service.http-client.ts` — onde a chamada é feita
- `src/modules/ticket/infra/actions/repair-completed.action.ts` — action que dispara a chamada
- Variável de ambiente `TICKET_SERVICE_URL`

---

## [TASK-005] Idempotência nas Transições da Saga via Eventos de Fila

**Contexto**

O orquestrador consome eventos do RabbitMQ via `AssignmentEventListener`. Quando o handler processa uma mensagem e lança uma exceção não tratada, o `@golevelup/nestjs-rabbitmq` faz o nack da mensagem e ela é reenfileirada — o que é o comportamento correto para falhas transitórias (ex: banco fora do ar).

O problema é que hoje **não há distinção entre falha transitória e evento já processado**. Se o `TicketStateMachineUseCase` processar o evento com sucesso, persistir o novo estado no banco, mas lançar uma exceção depois (ex: falha ao salvar o `TicketSagaEvent`), a mensagem é reenfileirada e o mesmo evento chega novamente. Na segunda entrega, o ticket já está no estado `ASSIGNED` e a máquina de estados lança `InvalidTransitionError` para o evento `SPECIALIST_ASSIGNED` — que é uma exceção de domínio, não uma falha transitória. O resultado é um loop de reentrega até a mensagem ir para a DLQ (quando houver) ou ser descartada.

**Cenário concreto**

```
1. Mensagem ticket.assignment.completed chega para ticketId=X
2. TicketStateMachineUseCase.execute() roda:
   a. Busca ticket → estado CREATED ✓
   b. Executa transição → estado ASSIGNED ✓
   c. ticketRepo.updateState() → persiste ASSIGNED ✓
   d. eventRepo.save() → FALHA (ex: timeout no banco)
3. Handler lança exceção → RabbitMQ faz nack → mensagem reenfileirada
4. Mesma mensagem chega novamente:
   a. Busca ticket → estado ASSIGNED
   b. Tenta SPECIALIST_ASSIGNED a partir de ASSIGNED → InvalidTransitionError
   c. Handler lança exceção → nack → loop
```

**O que deve ser feito**

A solução é detectar no início do `execute()` se o evento já foi processado e, se sim, retornar silenciosamente sem lançar exceção — fazendo o ack da mensagem.

1. Adicionar método `findLastEvent` na interface `ITicketSagaEventRepository` em `src/modules/ticket/domain/ticket-saga-event.repository.ts`:
   ```typescript
   findLastEvent(ticketId: string, event: TicketSagaEvent): Promise<TicketSagaEventEntity | null>
   ```

2. Implementar o método no `TicketSagaEventPrismaRepository` em `src/modules/ticket/infra/persistence/ticket-saga-event.prisma.repository.ts`:
   - Busca o registro mais recente em `ticket_saga_events` onde `ticketId = ticketId` e `triggeredBy = event`

3. No início de `TicketStateMachineUseCase.execute()`, antes de instanciar a máquina de estados, verificar se o evento já foi processado:
   ```typescript
   const alreadyProcessed = await this.eventRepo.findLastEvent(ticket.id, event);
   if (alreadyProcessed) {
     this.logger.warn({ ticketId, event, msg: 'duplicate event, skipping' });
     return { ticketId, from: alreadyProcessed.toState, to: alreadyProcessed.toState };
   }
   ```

4. Garantir que `ticketRepo.updateState()` e `eventRepo.save()` rodem na mesma transação de banco — hoje rodam em chamadas separadas, o que cria a janela de inconsistência descrita acima. Isso exige expor uma operação transacional no repositório ou usar o `PrismaService.$transaction` diretamente no use case via um método dedicado.

**Observação sobre o ponto 4**

A transação elimina a janela de inconsistência entre persistir o estado e salvar o evento. Sem ela, a idempotência do ponto 3 resolve o loop de reentrega mas não garante que o estado e o evento estejam sempre sincronizados. Os dois ajustes são complementares.

**Testes esperados**

Arquivo: `src/modules/ticket/application/use-cases/__tests__/ticket-state-machine.use-case.spec.ts`

- Retorna silenciosamente quando `findLastEvent` retorna um evento já processado
- Não chama `ticketRepo.updateState` nem `eventRepo.save` quando o evento é duplicado
- Loga warning quando evento duplicado é detectado
- Fluxo normal não é afetado quando `findLastEvent` retorna `null`

**Referências**
- Consumer onde o nack acontece: `src/modules/ticket/infra/messaging/assignment-event.listener.ts`
- Use case onde a transição é executada: `src/modules/ticket/application/use-cases/ticket-state-machine.use-case.ts`
- Repositório de eventos: `src/modules/ticket/infra/persistence/ticket-saga-event.prisma.repository.ts`
- Interface do repositório: `src/modules/ticket/domain/ticket-saga-event.repository.ts`

---

## [TASK-007] Job Diário de Escalation para Tickets que Excederam MAX_RETRIES

**Contexto**

O job de reconciliação (TASK-001) republica o evento `ticket.assignment.requested` para tickets presos em `CREATED`, mas para de retentar quando `attempts >= MAX_RETRIES`. Esses tickets continuam aparecendo na lista do reconciliation a cada execução — são ignorados com um `logger.warn`, mas nunca saem do radar automaticamente.

Um job diário deve identificar esses tickets e movê-los para um estado terminal de intervenção, tirando-os do ciclo de reconciliação e sinalizando que precisam de atenção humana.

**O que deve ser feito**

1. Adicionar o estado `INTERVENTION_REQUIRED` na saga (seguir os pontos de sincronização obrigatória do project-rules):
   - `src/modules/ticket/domain/ticket-saga.types.ts`
   - `prisma/schema.prisma`
   - `src/modules/ticket/domain/ticket-state-machine.ts`
   - Rodar `prisma migrate dev`

2. Adicionar método `findExceededMaxRetries(maxRetries: number): Promise<TicketEntity[]>` na interface `IReconciliationRepository` em `src/modules/ticket/domain/reconciliation.repository.ts`:
   - Busca tickets em `CREATED` que possuem `COUNT(reconciliation_logs) >= maxRetries`

3. Implementar o método no `ReconciliationPrismaRepository`

4. Criar o use case `src/modules/ticket/application/use-cases/escalate-stuck-tickets.use-case.ts`:
   - Busca tickets via `findExceededMaxRetries(MAX_RETRIES)`
   - Para cada ticket: transiciona para `INTERVENTION_REQUIRED` via `ITicketRepository.updateState()`
   - Loga estruturado com `ticketId` e `attempts` para cada ticket escalado

5. Criar `src/modules/ticket/application/use-cases/escalate-stuck-tickets.cron.ts` com `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`

6. Registrar o cron e o use case no `ticket.module.ts`

**Observação**

Após a transição para `INTERVENTION_REQUIRED`, o `findStuckInCreated` do reconciliation para de retornar esses tickets naturalmente — o filtro já é `currentState = CREATED`.

**Testes esperados**

Arquivo: `src/modules/ticket/application/use-cases/__tests__/escalate-stuck-tickets.use-case.spec.ts`

- Transiciona para `INTERVENTION_REQUIRED` tickets que excederam `MAX_RETRIES`
- Não faz nada se não houver tickets excedidos
- Processa cada ticket independentemente

**Referências**
- TASK-001: job de reconciliação que alimenta o cenário
- ADR-004: `docs/adrs/ADR-004-reconciliation-log-separate-table.md`
- Pontos de sincronização: `.amazonq/rules/project-rules.md`

---

## [TASK-006] Tratamento de Erro HTTP no `TicketServiceHttpClient`

**Contexto**

O `TicketServiceHttpClient` usa axios para se comunicar com o Serviço de Ticket. Hoje os dois métodos — `createTicket` e `completeTicket` — não tratam erros HTTP: qualquer resposta com status 4xx ou 5xx faz o axios lançar um `AxiosError` genérico que sobe sem tratamento até o use case.

O problema é que erros diferentes exigem reações diferentes, e hoje todos chegam como a mesma exceção opaca:

- **404** em `completeTicket` — o ticket não existe no Serviço de Ticket. Isso indica inconsistência entre os dois serviços (o orquestrador tem o ticket, o serviço externo não). Não adianta retentar — é um erro de dados.
- **409** em `completeTicket` — o ticket já está concluído no Serviço de Ticket. Pode ser reentrega de evento (ver TASK-005). Deve ser tratado como sucesso silencioso.
- **5xx / timeout** em qualquer chamada — falha transitória do serviço externo. Deve propagar para que a máquina de estados faça rollback e o caller decida se retenta.
- **400** em `createTicket` — payload inválido. Indica bug no orquestrador, não deve retentar.

Sem esse tratamento, o `RepairCompletedAction` recebe um `AxiosError` genérico, a máquina de estados faz rollback do estado (comportamento correto), mas o use case não consegue distinguir se deve retentar ou escalar o erro.

**Cenário concreto**

```
1. REPAIR_COMPLETED chega para ticketId=X
2. RepairCompletedAction chama completeTicket(externalTicketId)
3. Serviço de Ticket retorna 404 (ticket não existe lá)
4. AxiosError sobe sem tratamento
5. Máquina de estados faz rollback → ticket volta para ACCEPTED
6. Use case lança StateMachineExecutionError para o caller
7. Caller não sabe se é erro transitório ou permanente
8. Se vier de fila: nack → reentrega → loop eterno de 404
```

**O que deve ser feito**

1. Criar erros de domínio específicos para falhas de integração em `src/common/errors/domain.errors.ts`:
   ```typescript
   export class ExternalServiceNotFoundError extends Error { ... }   // 404
   export class ExternalServiceConflictError extends Error { ... }   // 409
   export class ExternalServiceUnavailableError extends Error { ... } // 5xx/timeout
   ```

2. Criar um helper privado `handleAxiosError(error: unknown): never` no `TicketServiceHttpClient` que inspeciona o `AxiosError` e lança o erro de domínio correspondente:
   ```typescript
   private handleAxiosError(error: unknown): never {
     if (axios.isAxiosError(error)) {
       const status = error.response?.status;
       if (status === 404) throw new ExternalServiceNotFoundError(...);
       if (status === 409) throw new ExternalServiceConflictError(...);
     }
     throw new ExternalServiceUnavailableError(...);
   }
   ```

3. Envolver as chamadas axios em `try/catch` em ambos os métodos e chamar `handleAxiosError` no catch

4. No `RepairCompletedAction.execute()`, capturar `ExternalServiceConflictError` e tratar como sucesso silencioso — se o ticket já está concluído no serviço externo, o objetivo foi atingido:
   ```typescript
   try {
     await this.ticketServiceClient.completeTicket(ctx.externalTicketId);
   } catch (error) {
     if (error instanceof ExternalServiceConflictError) {
       this.logger.warn(`ticket=${ctx.externalTicketId} already completed externally, skipping`);
       return;
     }
     throw error;
   }
   ```

5. Adicionar os novos erros ao `GlobalExceptionFilter` se necessário — `ExternalServiceUnavailableError` provavelmente deve mapear para 502 Bad Gateway quando vier de uma requisição HTTP direta

**Testes esperados**

Arquivo: `src/modules/ticket/infra/clients/__tests__/ticket-service.http-client.spec.ts`

- Lança `ExternalServiceNotFoundError` quando o serviço retorna 404
- Lança `ExternalServiceConflictError` quando o serviço retorna 409
- Lança `ExternalServiceUnavailableError` quando o serviço retorna 500
- Lança `ExternalServiceUnavailableError` em timeout
- Retorna normalmente em resposta 2xx

Arquivo: `src/modules/ticket/infra/actions/__tests__/repair-completed.action.spec.ts`

- Não lança quando `completeTicket` lança `ExternalServiceConflictError`
- Propaga quando `completeTicket` lança `ExternalServiceUnavailableError`

**Referências**
- Cliente HTTP: `src/modules/ticket/infra/clients/ticket-service.http-client.ts`
- Action que o chama: `src/modules/ticket/infra/actions/repair-completed.action.ts`
- Erros de domínio existentes: `src/common/errors/domain.errors.ts`
- Filter global: `src/common/filters/global-exception.filter.ts`
- TASK-005 — idempotência: o tratamento do 409 como sucesso silencioso é complementar à idempotência de eventos duplicados
