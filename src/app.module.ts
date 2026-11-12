import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './infra/database/database.module';
import { TicketModule } from './modules/ticket/ticket.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, TicketModule],
})
export class AppModule {}
