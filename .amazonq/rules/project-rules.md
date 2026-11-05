# Architecture & Development Guidelines

## Estrutura de Módulos

Cada feature é organizada por **intenção de negócio** (Bounded Context), nunca por camada técnica.

```
src/modules/[domain]/
├── domain/
│   ├── [domain].entity.ts          ← entidades e value objects
│   └── [domain].repository.ts      ← interface (port)
├── application/
│   └── use-cases/
│       └── [action].use-case.ts
├── infra/
│   └── persistence/
│       └── [domain].mongo.repository.ts   ← implementação concreta
├── interface/
│   ├── dto/
│   │   └── [action].dto.ts
│   └── [domain].controller.ts
└── [domain].module.ts
```

### Convenções de nomenclatura

- Use **dot notation** para nomes compostos: `content.generation`, `user.profile`
- Nunca use hyphens ou underscores para separar partes do nome do módulo

---

## Regras de Camadas

| Camada | Responsabilidade |
|---|---|
| `domain` | Entidades, Value Objects, regras puras de negócio |
| `application` | Use Cases, orquestração, ports (interfaces) |
| `infra` | Implementações concretas (DB, APIs externas, filas) |
| `interface` | Entrada de dados (HTTP, CLI, eventos) e DTOs |

- Regras de negócio vivem no `domain/`, nunca em controllers ou infra
- O domínio não conhece MongoDB, HTTP ou qualquer framework — depende apenas de abstrações
- Nenhum módulo acessa diretamente o repositório ou entidade de outro
- **Controllers nunca fazem mapeamento de DTO → entidade.** Recebem o DTO e passam diretamente ao use case. O mapeamento é responsabilidade do use case (`application/`)
- **Controllers não importam tipos do `domain/`** (entidades, value objects, enums). Se precisar de um tipo de domínio no controller, é sinal de que o mapeamento está no lugar errado

---

## Convenções de Código

### Interface-First com namespace

```typescript
export interface EventResponseDto {
  id: string;
  name: string;
  items: EventResponseDto.Item[];
}

export namespace EventResponseDto {
  export interface Item { ... }

  export function fromEntity(entity: Event): EventResponseDto { ... }
}
```

### DTO Validation

Use `class-validator` em todos os DTOs de entrada:

```typescript
export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  category?: string;
}
```

### Dependency Injection

```typescript
// module
@Module({
  controllers: [EventsController],
  providers: [
    { provide: EVENTS_REPOSITORY_TOKEN, useClass: EventsMongoRepository },
  ],
})

// use case / controller
constructor(
  @Inject(EVENTS_REPOSITORY_TOKEN) private readonly repo: EventsRepository,
) {}
```

### Error Handling

Use as exceções nativas do NestJS:

- `NotFoundException` — recurso não encontrado
- `BadRequestException` — erro de validação
- `UnauthorizedException` — falha de autenticação

---

## ESLint

Regras desabilitadas no projeto:

- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-namespace`

---

## ADRs

Sempre que uma decisão técnica relevante for tomada (escolha de lib, modelo, estratégia de persistência, padrão arquitetural), registre em `docs/adrs/ADR-NNN-titulo-curto.md`.

Formato mínimo:
- **Status** (Aceito / Substituído / Depreciado)
- **Contexto** — qual problema motivou a decisão
- **Decisão** — o que foi escolhido e por quê
- **Consequências** — impactos e trade-offs

---

## Quando NÃO separar em módulos

Só crie um novo módulo se o fluxo de negócio for **genuinamente independente**. Se uma mudança de regra exige alterar mais de um módulo ao mesmo tempo, os limites estão errados.
