import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DatabaseModule } from '../../infra/database/database.module';
import { TicketController } from './interface/ticket.controller';
import { TicketInternalController } from './interface/ticket.internal.controller';
import {
  TicketStateMachineUseCase,
  TICKET_STATE_MACHINE_USE_CASE,
} from './application/use-cases/ticket-state-machine.use-case';
import {
  CreateTicketUseCase,
  CREATE_TICKET_USE_CASE,
} from './application/use-cases/create-ticket.use-case';
import {
  ReconcileStuckTicketsUseCase,
  RECONCILE_STUCK_TICKETS_USE_CASE,
} from './application/use-cases/reconcile-stuck-tickets.use-case';
import { ReconcileStuckTicketsCron } from './application/use-cases/reconcile-stuck-tickets.cron';
import { TICKET_REPOSITORY } from './domain/ticket.repository';
import { TICKET_SAGA_EVENT_REPOSITORY } from './domain/ticket-saga-event.repository';
import { RECONCILIATION_REPOSITORY } from './domain/reconciliation.repository';
import {
  TICKET_SERVICE_CLIENT,
  ASSIGNMENT_EVENT_PUBLISHER,
} from './domain/actions';
import { TicketPrismaRepository } from './infra/persistence/ticket.prisma.repository';
import { TicketSagaEventPrismaRepository } from './infra/persistence/ticket-saga-event.prisma.repository';
import { ReconciliationPrismaRepository } from './infra/persistence/reconciliation.prisma.repository';
import { AssignSpecialistAction } from './infra/actions/assign-specialist.action';
import { RouteTicketAction } from './infra/actions/route-ticket.action';
import { RepairCompletedAction } from './infra/actions/repair-completed.action';
import { ReassignRequestedAction } from './infra/actions/reassign-requested.action';
import { SurveySentAction } from './infra/actions/survey-sent.action';
import { SurveyFailedAction } from './infra/actions/survey-failed.action';
import { TicketServiceHttpClient } from './infra/clients/ticket-service.http-client';
import {
  AssignmentEventPublisher,
  TICKET_MANAGEMENT_EXCHANGE,
} from './infra/messaging/assignment-event.publisher';
import { AssignmentEventListener } from './infra/messaging/assignment-event.listener';

@Module({
  imports: [
    DatabaseModule,
    RabbitMQModule.forRoot({
      uri: process.env.RABBITMQ_URL!,
      exchanges: [
        {
          name: TICKET_MANAGEMENT_EXCHANGE,
          type: 'topic',
        },
      ],
      connectionInitOptions: { wait: false },
    }),
  ],
  controllers: [TicketController, TicketInternalController],
  providers: [
    AssignSpecialistAction,
    RouteTicketAction,
    RepairCompletedAction,
    ReassignRequestedAction,
    SurveySentAction,
    SurveyFailedAction,
    AssignmentEventPublisher,
    AssignmentEventListener,
    ReconcileStuckTicketsCron,
    { provide: TICKET_SERVICE_CLIENT, useClass: TicketServiceHttpClient },
    { provide: ASSIGNMENT_EVENT_PUBLISHER, useClass: AssignmentEventPublisher },
    { provide: TICKET_REPOSITORY, useClass: TicketPrismaRepository },
    {
      provide: TICKET_SAGA_EVENT_REPOSITORY,
      useClass: TicketSagaEventPrismaRepository,
    },
    {
      provide: RECONCILIATION_REPOSITORY,
      useClass: ReconciliationPrismaRepository,
    },
    { provide: CREATE_TICKET_USE_CASE, useClass: CreateTicketUseCase },
    {
      provide: TICKET_STATE_MACHINE_USE_CASE,
      useClass: TicketStateMachineUseCase,
    },
    {
      provide: RECONCILE_STUCK_TICKETS_USE_CASE,
      useClass: ReconcileStuckTicketsUseCase,
    },
  ],
})
export class TicketModule {}
