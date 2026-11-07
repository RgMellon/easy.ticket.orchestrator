/*
  Warnings:

  - A unique constraint covering the columns `[ticket_id]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ticket_id` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "ticket_id" VARCHAR(50) NOT NULL,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_id_key" ON "tickets"("ticket_id");
