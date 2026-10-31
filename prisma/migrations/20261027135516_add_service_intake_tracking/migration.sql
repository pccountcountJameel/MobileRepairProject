/*
  Warnings:

  - A unique constraint covering the columns `[trackingNumber]` on the table `services` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('not_requested', 'pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "intakeAccessories" TEXT,
ADD COLUMN     "intakeCondition" TEXT,
ADD COLUMN     "intakeNotes" TEXT,
ADD COLUMN     "quoteAmount" INTEGER,
ADD COLUMN     "quoteStatus" "QuoteStatus" NOT NULL DEFAULT 'not_requested',
ADD COLUMN     "repairActions" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "service_status_history" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_status_history_serviceId_createdAt_idx" ON "service_status_history"("serviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "services_trackingNumber_key" ON "services"("trackingNumber");

-- CreateIndex
CREATE INDEX "services_status_idx" ON "services"("status");

-- AddForeignKey
ALTER TABLE "service_status_history" ADD CONSTRAINT "service_status_history_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
