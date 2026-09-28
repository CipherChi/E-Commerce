-- Nullable first so records without a unique business context remain valid.
ALTER TABLE "ActivityLog" ADD COLUMN "businessId" TEXT;

-- Backfill only users with exactly one membership. A user's most recent membership
-- is not a safe substitute for the business that caused an older event.
UPDATE "ActivityLog" AS log
SET "businessId" = membership."businessId"
FROM (
  SELECT "userId", MIN("businessId") AS "businessId"
  FROM "BusinessMember"
  GROUP BY "userId"
  HAVING COUNT(*) = 1
) AS membership
WHERE log."userId" = membership."userId";

-- Existing rows without a unique membership keep the column nullable. Empty
-- databases also keep it nullable to allow explicitly global events.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ActivityLog")
     AND NOT EXISTS (SELECT 1 FROM "ActivityLog" WHERE "businessId" IS NULL) THEN
    ALTER TABLE "ActivityLog" ALTER COLUMN "businessId" SET NOT NULL;
  END IF;
END $$;

ALTER TABLE "ActivityLog"
  ADD CONSTRAINT "ActivityLog_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ActivityLog_businessId_createdAt_idx"
  ON "ActivityLog"("businessId", "createdAt");
