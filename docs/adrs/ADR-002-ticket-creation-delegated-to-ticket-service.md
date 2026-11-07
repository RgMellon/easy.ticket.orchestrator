# ADR-002 — Criação de Ticket Delegada ao Serviço de Ticket

**Status:** Aceito

## Contexto

Inicialmente, o Orquestrador criava o ticket diretamente no próprio banco, gerando o `id` localmente. Isso misturava responsabilidade de persistência de negócio (o ticket em si) com responsabilidade de orquestração (conduzir a saga).

Com a introdução do Serviço de Ticket como microserviço independente com banco próprio, o ticket passa a ser uma entidade que pertence a esse serviço — não ao Orquestrador.

## Decisão

A criação do ticket é **delegada ao Serviço de Ticket** via chamada HTTP síncrona. O Orquestrador:

1. Recebe o `POST /tickets` com o `clientId`
2. Chama o Serviço de Ticket, que cria o ticket e retorna o `ticketId`
3. Persiste localmente **apenas o contexto da saga**: `ticketId` (vindo de fora), `clientId` e `currentState: CREATED`

O `id` do ticket no banco do Orquestrador deixa de ser gerado localmente — passa a ser o mesmo `id` retornado pelo Serviço de Ticket.

A abstração da chamada HTTP é modelada como um port `ITicketServiceClient` no domínio, com implementação concreta em `infra/`. Isso mantém o domínio livre de dependências de tecnologia e permite substituir a implementação (HTTP, gRPC, mock) sem alterar use cases.

## Consequências

- O Orquestrador não é mais a fonte de verdade dos dados do ticket — apenas do estado da saga
- O `ticketId` no banco do Orquestrador é uma referência ao ticket real que vive no Serviço de Ticket
- Em ambiente de desenvolvimento/testes, a implementação concreta pode ser substituída por um stub sem alterar nada no domínio ou application
- Se o Serviço de Ticket estiver indisponível, a criação falha — não há fallback local (decisão intencional: sem ticket criado lá, a saga não deve iniciar)
