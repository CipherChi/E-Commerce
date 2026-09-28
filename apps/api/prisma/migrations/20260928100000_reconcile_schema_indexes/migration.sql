-- Align the database with the declared tenant indexes while preserving legacy indexes.
CREATE INDEX IF NOT EXISTS "Sale_businessId_receiptNumber_idx"
  ON "Sale"("businessId", "receiptNumber");
