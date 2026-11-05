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

## Requisitos

- Docker e Docker Compose
- Node.js (apenas para desenvolvimento local)

## Desenvolvimento

### Local (recomendado)

Sobe apenas o Postgres no Docker e roda a aplicação localmente com hot-reload:

```bash
docker compose -f docker-compose.dev.yml up -d
yarn install
yarn prisma:generate
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
docker compose exec app yarn prisma:migrate
```

### Gerar o Prisma Client após alterar o schema

```bash
docker compose exec app yarn prisma:generate
```

### Abrir o Prisma Studio

```bash
docker compose exec app yarn prisma:studio
```

## Build de produção

Copie `.env.prod` e ajuste as variáveis:

```bash
cp .env.prod .env.prod  # edite POSTGRES_PASSWORD e demais vars
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
# unit
docker compose exec app yarn test

# e2e
docker compose exec app yarn test:e2e

# coverage
docker compose exec app yarn test:cov
```
