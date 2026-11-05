import { Module } from '@nestjs/common';
import { DatabaseModule } from './infra/database/database.module';
import { TicketModule } from './modules/ticket/ticket.module';

@Module({
  imports: [DatabaseModule, TicketModule],
})
export class AppModule {}
