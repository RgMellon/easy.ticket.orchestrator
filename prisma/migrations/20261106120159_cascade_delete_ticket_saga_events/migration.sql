-- DropForeignKey
ALTER TABLE "ticket_saga_events" DROP CONSTRAINT "ticket_saga_events_ticket_id_fkey";

-- AddForeignKey
ALTER TABLE "ticket_saga_events" ADD CONSTRAINT "ticket_saga_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
