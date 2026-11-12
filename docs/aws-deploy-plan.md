# Plano de Deploy na AWS

Decisões e estratégia para subir o easy.ticket em produção na AWS.

---

## Arquitetura alvo (prod)

```
App Móvel
    │
    ▼
ALB (Application Load Balancer)
    │
    ▼
ECS Fargate — orchestrator (porta 3000)
    │
    ├──► ECS Fargate — ticket.service (porta 3001)  [interno, sem ALB]
    │
    └──► ECS Fargate — assignment (porta 3003)       [interno, sem ALB]
         │
         ├──► Amazon MQ (RabbitMQ gerenciado)
         │
         └──► RDS PostgreSQL (1 instância, 3 databases)
```

- Só o orchestrator fica exposto via ALB
- Os outros serviços ficam numa VPC privada
- Serviços se comunicam via AWS Cloud Map (Service Discovery)

---

## Componentes e decisões

### API Gateway
Não necessário agora. O app móvel fala só com o orchestrator. Um ALB na frente do orchestrator já resolve. Reavaliar quando precisar de auth centralizada ou rate limiting.

### Containers (ECS Fargate)
- Sem gerenciar servidor — só manda a imagem Docker e define CPU/memória
- Imagens armazenadas no ECR (Elastic Container Registry)
- Free Tier **não cobre** Fargate (cobre EC2)

### RabbitMQ (Amazon MQ)
- AWS gerencia patch, backup e reinicialização
- Só muda a `RABBITMQ_URL` no `.env`
- Free Tier **não cobre** Amazon MQ (~$25-35/mês no `mq.t3.micro`)

### Banco de dados (RDS PostgreSQL)
- 1 instância RDS com 3 databases separados: `orchestrator_db`, `ticket_db`, `assignment_db`
- Nunca no mesmo container/servidor da aplicação
- Free Tier cobre `db.t3.micro` por 12 meses

### Kubernetes
Não necessário agora. ECS Fargate resolve com muito menos complexidade. Reavaliar se precisar de escala horizontal avançada (EKS nesse caso).

---

## Custo estimado (prod, tier mínimo)

| Serviço | Configuração | Custo/mês aprox |
|---|---|---|
| ECS Fargate | 3 serviços, 0.25 vCPU / 512MB cada | ~$15-25 |
| ALB | 1 load balancer | ~$20 |
| RDS PostgreSQL | `db.t3.micro`, 1 instância, 3 databases | ~$15-25 |
| Amazon MQ | `mq.t3.micro` | ~$25-35 |
| ECR | Armazenamento de imagens | ~$1-5 |
| **Total** | | **~$75-110/mês** |

---

## Estratégia Free Tier (validação sem custo)

Usar enquanto a conta AWS estiver no período gratuito (12 meses).

Substituições:
- **ECS Fargate** → EC2 `t3.micro` com Docker Compose direto (Free Tier cobre 750h/mês)
- **Amazon MQ** → container RabbitMQ na mesma EC2 (Amazon MQ não tem Free Tier)
- **RDS** → `db.t3.micro` (coberto pelo Free Tier)
- **ALB** → coberto pelo Free Tier (750h/mês)

Na prática: sobe tudo em 1 ou 2 EC2 `t3.micro` com Docker Compose, igual ao ambiente local. Custo: ~$0 no Free Tier.

Quando for pra prod com usuários reais, migra pra arquitetura com Fargate + Amazon MQ + RDS dedicado.

---

## Fluxo de deploy (prod)

1. Build da imagem: `docker build -t easy-ticket-orchestrator .`
2. Push pro ECR
3. ECS Fargate puxa a imagem do ECR e sobe o container

O `docker-compose.prod.yml` serve de referência pras configs, mas quem executa em prod é o ECS.

---

## Próximos passos

- [ ] Configurar VPC com subnets públicas e privadas
- [ ] Criar repositórios no ECR para cada serviço
- [ ] Configurar ECS cluster + task definitions
- [ ] Subir RDS com 3 databases
- [ ] Subir Amazon MQ
- [ ] Configurar AWS Cloud Map para Service Discovery entre os serviços
- [ ] Configurar ALB apontando pro orchestrator
- [ ] Pipeline CI/CD (GitHub Actions → ECR → ECS)
