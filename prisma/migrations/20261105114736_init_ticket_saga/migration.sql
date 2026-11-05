-- CreateEnum
CREATE TYPE "ticket_saga_state" AS ENUM ('CREATED', 'ASSIGNED', 'ACCEPTED', 'REASSIGN', 'COMPLETED', 'NO_SURVEY', 'CLOSED');

-- CreateEnum
CREATE TYPE "ticket_saga_event" AS ENUM ('SPECIALIST_ASSIGNED', 'TICKET_ROUTED', 'REPAIR_COMPLETED', 'REASSIGN_REQUESTED', 'SURVEY_SENT', 'SURVEY_FAILED');

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" VARCHAR(50) NOT NULL,
    "specialist_id" VARCHAR(50),
    "current_state" "ticket_saga_state" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_saga_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "from_state" "ticket_saga_state" NOT NULL,
    "to_state" "ticket_saga_state" NOT NULL,
    "triggered_by" "ticket_saga_event" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_saga_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ticket_saga_events" ADD CONSTRAINT "ticket_saga_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
