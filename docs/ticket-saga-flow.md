# Ticket Saga — Estados e Transições

## Diagrama de Fluxo

```
                        ┌─────────────────┐
                        │   [START]        │
                        │  ticket criado   │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    CREATED       │
                        │                  │
                        │ Aguardando       │
                        │ especialista     │
                        └────────┬────────┘
                                 │ SPECIALIST_ASSIGNED
                                 ▼
                        ┌─────────────────┐
               ┌───────▶│    ASSIGNED      │
               │        │                  │
               │        │ Especialista     │
               │        │ atribuído,       │
               │        │ aguardando       │
               │        │ confirmação      │
               │        └────────┬────────┘
               │                 │ TICKET_ROUTED
               │                 ▼
               │        ┌─────────────────┐
               │        │    ACCEPTED      │
               │        │                  │
               │        │ Especialista     │
               │        │ confirmou,       │
               │        │ em andamento     │
               │        └────────┬────────┘
               │                 │
               │        ┌────────┴────────┐
               │        │                  │
               │  REASSIGN_REQUESTED  REPAIR_COMPLETED
               │        │                  │
               │        ▼                  ▼
               │ ┌─────────────┐  ┌─────────────────┐
               │ │   REASSIGN  │  │    COMPLETED     │
               │ │             │  │                  │
               │ │ Reagendando │  │ Reparo concluído,│
               │ │ especialista│  │ enviando pesquisa│
               │ └──────┬──────┘  └────────┬────────┘
               │        │                  │
               │ SPECIALIST_ASSIGNED       ├─────────────────┐
               └────────┘            SURVEY_SENT        SURVEY_FAILED
                                          │                  │
                                          ▼                  ▼
                                 ┌──────────────┐  ┌──────────────────┐
                                 │    CLOSED     │  │    NO_SURVEY     │
                                 │               │  │                  │
                                 │ Fim da saga   │  │ Pesquisa não     │
                                 │               │  │ enviada, retry   │
                                 └──────────────┘  │ pendente         │
                                                    └────────┬─────────┘
                                                             │ SURVEY_SENT
                                                             ▼
                                                    ┌──────────────┐
                                                    │    CLOSED     │
                                                    │               │
                                                    │ Fim da saga   │
                                                    └──────────────┘
```

---

## Tabela de Transições

| Estado Atual | Evento               | Próximo Estado | Descrição                                                                 |
|--------------|----------------------|----------------|---------------------------------------------------------------------------|
| `CREATED`    | `SPECIALIST_ASSIGNED`| `ASSIGNED`     | Um especialista foi encontrado e atribuído ao ticket                      |
| `ASSIGNED`   | `TICKET_ROUTED`      | `ACCEPTED`     | O especialista confirmou o recebimento do ticket                          |
| `ACCEPTED`   | `REPAIR_COMPLETED`   | `COMPLETED`    | O especialista concluiu o reparo                                          |
| `ACCEPTED`   | `REASSIGN_REQUESTED` | `REASSIGN`     | O especialista não consegue atender, ticket precisa ser reatribuído       |
| `REASSIGN`   | `SPECIALIST_ASSIGNED`| `ASSIGNED`     | Novo especialista encontrado, fluxo retoma a partir de ASSIGNED           |
| `COMPLETED`  | `SURVEY_SENT`        | `CLOSED`       | Pesquisa enviada ao cliente com sucesso, saga encerrada                   |
| `COMPLETED`  | `SURVEY_FAILED`      | `NO_SURVEY`    | Falha no envio da pesquisa, ticket encerrado funcionalmente sem pesquisa  |
| `NO_SURVEY`  | `SURVEY_SENT`        | `CLOSED`       | Retry do envio de pesquisa bem-sucedido, saga encerrada                   |

---

## Descrição dos Estados

| Estado      | Descrição                                                                                      | Terminal |
|-------------|------------------------------------------------------------------------------------------------|----------|
| `CREATED`   | Ticket recém-criado. Aguarda um especialista disponível para ser atribuído.                    | Não      |
| `ASSIGNED`  | Especialista atribuído. Aguarda confirmação de recebimento pelo especialista.                  | Não      |
| `ACCEPTED`  | Especialista confirmou o ticket e está trabalhando no problema.                                | Não      |
| `REASSIGN`  | Especialista não pôde atender. Aguarda novo especialista disponível.                           | Não      |
| `COMPLETED` | Reparo concluído. Sistema tentando enviar pesquisa de satisfação ao cliente.                   | Não      |
| `NO_SURVEY` | Pesquisa não enviada por falha no serviço. Retry pendente. Ticket encerrado para o cliente.    | Não      |
| `CLOSED`    | Saga encerrada. Pesquisa enviada com sucesso.                                                  | **Sim**  |

---

## Notas de Comportamento

- **CREATED e REASSIGN** — a saga fica parada nesses estados até que um especialista esteja disponível. Não há timeout definido nessa etapa.
- **ASSIGNED** — presume-se que o especialista foi localizado e está disponível. Se o roteamento falhar, a saga permanece em `ASSIGNED` até conseguir rotear.
- **COMPLETED → NO_SURVEY** — o cliente não recebe erro. O ticket é considerado encerrado funcionalmente. O retry do envio da pesquisa é eventual.
- **CLOSED** — único estado terminal. Uma vez atingido, nenhum evento é aceito.
