CREATE TYPE "PaymentMethod" AS ENUM (
    'cash',
    'bank_transfer',
    'card',
    'other'
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_orderId_createdAt_idx"
ON "payments"("orderId", "createdAt");

ALTER TABLE "payments"
ADD CONSTRAINT "payments_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "orders"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;