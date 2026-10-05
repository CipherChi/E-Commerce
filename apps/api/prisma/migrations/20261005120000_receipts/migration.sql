CREATE TABLE "ReceiptSequence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "businessId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Sale" ADD COLUMN "receiptToken" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

UPDATE "Sale" SET "receiptToken" = replace(gen_random_uuid()::text, '-', ''),
  "idempotencyKey" = 'legacy-' || replace(gen_random_uuid()::text, '-', '');

ALTER TABLE "Sale" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "Sale_receiptToken_key" ON "Sale"("receiptToken");
CREATE UNIQUE INDEX "Sale_businessId_idempotencyKey_key" ON "Sale"("businessId", "idempotencyKey");
DROP INDEX "Sale_receiptNumber_key";
CREATE UNIQUE INDEX "Sale_businessId_receiptNumber_key" ON "Sale"("businessId", "receiptNumber");
CREATE UNIQUE INDEX "ReceiptSequence_businessId_year_key" ON "ReceiptSequence"("businessId", "year");
ALTER TABLE "ReceiptSequence" ADD CONSTRAINT "ReceiptSequence_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ReceiptSequence" ("id", "businessId", "year", "lastNumber", "updatedAt")
SELECT gen_random_uuid(), s."businessId", extract(year from s."createdAt")::integer,
       max(substring(s."receiptNumber" from '([0-9]+)$')::integer), now()
FROM "Sale" s
WHERE s."receiptNumber" ~ '^(RCT|RCPT)-[0-9]{4}-[0-9]+$'
GROUP BY s."businessId", extract(year from s."createdAt")
ON CONFLICT ("businessId", "year") DO UPDATE SET "lastNumber" = greatest("ReceiptSequence"."lastNumber", EXCLUDED."lastNumber");
