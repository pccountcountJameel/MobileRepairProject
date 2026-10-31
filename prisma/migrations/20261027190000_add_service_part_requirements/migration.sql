-- CreateEnum
CREATE TYPE "ServicePartStatus" AS ENUM (
    'requested',
    'unavailable',
    'partially_reserved',
    'reserved'
);

-- CreateTable
CREATE TABLE "service_part_requirements" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "sparePartId" TEXT,
    "requestedPartName" TEXT NOT NULL,
    "requestedCode" TEXT,
    "quantityRequired" INTEGER NOT NULL,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" INTEGER,
    "status" "ServicePartStatus" NOT NULL DEFAULT 'requested',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_part_requirements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_part_requirements_quantityRequired_check"
        CHECK ("quantityRequired" > 0),
    CONSTRAINT "service_part_requirements_quantityReserved_check"
        CHECK (
            "quantityReserved" >= 0
            AND "quantityReserved" <= "quantityRequired"
        ),
    CONSTRAINT "service_part_requirements_unitPrice_check"
        CHECK ("unitPrice" IS NULL OR "unitPrice" >= 0)
);

-- CreateIndex
CREATE INDEX "service_part_requirements_serviceId_idx"
ON "service_part_requirements"("serviceId");

CREATE INDEX "service_part_requirements_sparePartId_idx"
ON "service_part_requirements"("sparePartId");

CREATE INDEX "service_part_requirements_status_idx"
ON "service_part_requirements"("status");

-- AddForeignKey
ALTER TABLE "service_part_requirements"
ADD CONSTRAINT "service_part_requirements_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "services"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_part_requirements"
ADD CONSTRAINT "service_part_requirements_sparePartId_fkey"
FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
