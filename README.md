# easy.ticket.orchestrator

Orquestrador da saga transacional de tickets de suporte técnico. Gerencia o ciclo de vida completo de um ticket desde a criação até o encerramento, coordenando especialistas, roteamento e pesquisa de satisfação.

## Fluxo da Saga

```
                        ┌─────────────────┐
                        │     [START]      │
                        │  ticket criado   │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    CREATED       │
                        │ Aguardando       │
                        │ especialista     │
                        └────────┬────────┘
                                 │ SPECIALIST_ASSIGNED
                                 ▼
                        ┌─────────────────┐
               ┌───────▶│    ASSIGNED      │
               │        │ Especialista     │
               │        │ atribuído,       │
               │        │ aguardando       │
               │        │ confirmação      │
               │        └────────┬────────┘
               │                 │ TICKET_ROUTED
               │                 ▼
               │        ┌─────────────────┐
               │        │    ACCEPTED      │
               │        │ Especialista     │
               │        │ confirmou,       │
               │        │ em andamento     │
               │        └────────┬────────┘
               │                 │
               │        ┌────────┴────────┐
               │  REASSIGN_REQUESTED  REPAIR_COMPLETED
               │        │                  │
               │        ▼                  ▼
               │ ┌─────────────┐  ┌─────────────────┐
               │ │   REASSIGN  │  │    COMPLETED     │
               │ │ Reagendando │  │ Reparo concluído,│
               │ │ especialista│  │ enviando pesquisa│
               │ └──────┬──────┘  └────────┬────────┘
               │        │                  │
               │ SPECIALIST_ASSIGNED  ┌────┴────────────┐
               └────────┘        SURVEY_SENT       SURVEY_FAILED
                                       │                 │
                                       ▼                 ▼
                                ┌─────────────┐  ┌─────────────┐
                                │   CLOSED ✓  │  │  NO_SURVEY  │
                                │ Fim da saga │  │ Retry pend. │
                                └─────────────┘  └──────┬──────┘
                                                        │ SURVEY_SENT
                                                        ▼
                                                ┌─────────────┐
                                                │   CLOSED ✓  │
                                                │ Fim da saga │
                                                └─────────────┘
```

| Estado | Descrição | Terminal |
|---|---|---|
| `CREATED` | Aguarda especialista disponível | Não |
| `ASSIGNED` | Especialista atribuído, aguarda confirmação | Não |
| `ACCEPTED` | Em andamento pelo especialista | Não |
| `REASSIGN` | Aguarda novo especialista | Não |
| `COMPLETED` | Reparo concluído, enviando pesquisa | Não |
| `NO_SURVEY` | Pesquisa falhou, retry pendente | Não |
| `CLOSED` | Saga encerrada | **Sim** |

## Documentação

- [Fluxo da Saga do Ticket](docs/ticket-saga-flow.md) — estados, transições e diagrama de fluxo
- [Fluxo de Execução](docs/execution-flow.md) — sequência de arquivos chamados na criação e transição de ticket
- [ADR-001 — Saga Orquestrada com Máquina de Estado](docs/adrs/ADR-001-ticket-saga-state-machine.md)
- [ADR-002 — Criação de Ticket Delegada ao Serviço de Ticket](docs/adrs/ADR-002-ticket-creation-delegated-to-ticket-service.md)
- [ADR-003 — Atribuição de Especialista Assíncrona via RabbitMQ](docs/adrs/ADR-003-async-specialist-assignment-via-rabbitmq.md)
- [Backlog de Tarefas](docs/backlog.md)

## Requisitos

- Docker e Docker Compose
- Node.js 20+ (apenas para desenvolvimento local)
- Yarn

## Variáveis de Ambiente

| Variável | Descrição | Padrão dev |
|---|---|---|
| `DATABASE_URL` | Connection string do Postgres | `postgresql://easy_ticket:easy_ticket@localhost:5432/easy_ticket` |
| `RABBITMQ_URL` | URL de conexão do RabbitMQ | `amqp://easy_ticket:easy_ticket@localhost:5672` |
| `TICKET_SERVICE_URL` | URL do serviço de ticket | `http://localhost:3001` |
| `ASSIGNMENT_SERVICE_URL` | URL do serviço de assignment | `http://localhost:3003` |
| `SURVEY_SERVICE_URL` | URL do serviço de pesquisa | `http://localhost:3004` |
| `PORT` | Porta HTTP da aplicação | `3000` |

Em desenvolvimento, copie o `.env` já existente — as variáveis já estão preenchidas com os valores do Docker Compose local.

## Mensageria (RabbitMQ)

O orquestrador usa RabbitMQ para a atribuição assíncrona de especialistas.

### Subir o RabbitMQ

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Acessar o Management UI

- URL: `http://localhost:15672`
- Usuário: `easy_ticket`
- Senha: `easy_ticket`

A exchange `ticket.management` (tipo `topic`) e as filas são criadas automaticamente quando a aplicação sobe.

### Exchanges e routing keys

| Exchange | Tipo | Routing key | Publicado por | Consumido por |
|---|---|---|---|---|
| `ticket.management` | topic | `ticket.assignment.requested` | Orquestrador | Serviço de Assignment |
| `ticket.management` | topic | `ticket.assignment.completed` | Serviço de Assignment | Orquestrador |

### Simular eventos em desenvolvimento

Para testar o listener sem o serviço de assignment rodando:

```bash
curl -X POST http://localhost:3000/internal/tickets/{ticketId}/simulate/assignment-requested
```

## Desenvolvimento

### Primeiro setup

```bash
git clone <repo>
cd easy.ticket.orchestrator
yarn install
```

### Local (recomendado)

Sobe o Postgres e o RabbitMQ no Docker e roda a aplicação localmente com hot-reload:

```bash
docker compose -f docker-compose.dev.yml up -d
yarn prisma:generate
yarn prisma:migrate
yarn start:dev
```

A API estará disponível em `http://localhost:3000`.

### Tudo no Docker

```bash
docker compose up
```

## Banco de dados

### Criar/aplicar migrations

```bash
# local
yarn prisma:migrate

# dentro do container
docker compose exec app yarn prisma:migrate
```

### Gerar o Prisma Client após alterar o schema

```bash
# local
yarn prisma:generate

# dentro do container
docker compose exec app yarn prisma:generate
```

### Abrir o Prisma Studio

```bash
# local
yarn prisma:studio

# dentro do container
docker compose exec app yarn prisma:studio
```

## Build de produção

Copie `.env.prod` e ajuste as variáveis:

```bash
cp .env.prod .env.prod.local  # edite POSTGRES_PASSWORD, RABBITMQ_URL e demais vars
```

Suba com:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Diferenças em relação ao dev:
- Sem volume bind (código dentro da imagem)
- Sem hot-reload
- Roda `node dist/main` direto
- `restart: unless-stopped` ativo

## Testes

```bash
# unit (local)
yarn test

# unit (dentro do container)
docker compose exec app yarn test

# e2e
docker compose exec app yarn test:e2e

# coverage
yarn test:cov
```
