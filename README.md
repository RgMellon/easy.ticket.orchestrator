# easy.ticket.orchestrator

## Requisitos

- Docker
- Docker Compose

> Node.js **não é necessário** localmente. Tudo roda dentro do Docker.

## Desenvolvimento

Sobe o banco e a aplicação com hot-reload:

```bash
docker compose up
```

A API estará disponível em `http://localhost:3000`.

O Nest watch está ativo — qualquer alteração em `src/` reinicia automaticamente.

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
