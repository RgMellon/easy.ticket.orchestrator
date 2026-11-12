-- CreateTable
CREATE TABLE "ticket_reconciliation_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "retried_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ticket_reconciliation_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ticket_reconciliation_logs" ADD CONSTRAINT "ticket_reconciliation_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
