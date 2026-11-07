import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infra/database/database.module';
import { TicketController } from './interface/ticket.controller';
import {
  TicketStateMachineUseCase,
  TICKET_STATE_MACHINE_USE_CASE,
} from './application/use-cases/ticket-state-machine.use-case';
import {
  CreateTicketUseCase,
  CREATE_TICKET_USE_CASE,
} from './application/use-cases/create-ticket.use-case';
import { TICKET_REPOSITORY } from './domain/ticket.repository';
import { TICKET_SAGA_EVENT_REPOSITORY } from './domain/ticket-saga-event.repository';
import { TICKET_ACTIONS, TICKET_SERVICE_CLIENT, ASSIGNMENT_SERVICE_CLIENT } from './domain/ticket.actions';
import { TicketPrismaRepository } from './infra/persistence/ticket.prisma.repository';
import { TicketSagaEventPrismaRepository } from './infra/persistence/ticket-saga-event.prisma.repository';
import { AssignSpecialistAction } from './infra/actions/assign-specialist.action';
import { RouteTicketAction } from './infra/actions/route-ticket.action';
import { RepairCompletedAction } from './infra/actions/repair-completed.action';
import { ReassignRequestedAction } from './infra/actions/reassign-requested.action';
import { SurveySentAction } from './infra/actions/survey-sent.action';
import { SurveyFailedAction } from './infra/actions/survey-failed.action';
import { TicketServiceHttpClient } from './infra/clients/ticket-service.http-client';
import { AssignmentServiceHttpClient } from './infra/clients/assignment-service.http-client';

@Module({
  imports: [DatabaseModule],
  controllers: [TicketController],
  providers: [
    AssignSpecialistAction,
    RouteTicketAction,
    RepairCompletedAction,
    ReassignRequestedAction,
    SurveySentAction,
    SurveyFailedAction,
    { provide: TICKET_SERVICE_CLIENT, useClass: TicketServiceHttpClient },
    { provide: ASSIGNMENT_SERVICE_CLIENT, useClass: AssignmentServiceHttpClient },
    { provide: TICKET_REPOSITORY, useClass: TicketPrismaRepository },
    {
      provide: TICKET_SAGA_EVENT_REPOSITORY,
      useClass: TicketSagaEventPrismaRepository,
    },
    {
      provide: TICKET_ACTIONS,
      useFactory: (
        assignSpecialist: AssignSpecialistAction,
        routeTicket: RouteTicketAction,
        repairCompleted: RepairCompletedAction,
        reassignRequested: ReassignRequestedAction,
        surveySent: SurveySentAction,
        surveyFailed: SurveyFailedAction,
      ) => ({
        assignSpecialist,
        routeTicket,
        repairCompleted,
        reassignRequested,
        surveySent,
        surveyFailed,
      }),
      inject: [
        AssignSpecialistAction,
        RouteTicketAction,
        RepairCompletedAction,
        ReassignRequestedAction,
        SurveySentAction,
        SurveyFailedAction,
      ],
    },
    { provide: CREATE_TICKET_USE_CASE, useClass: CreateTicketUseCase },
    {
      provide: TICKET_STATE_MACHINE_USE_CASE,
      useClass: TicketStateMachineUseCase,
    },
  ],
})
export class TicketModule {}
