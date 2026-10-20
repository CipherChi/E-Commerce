ALTER TABLE "BusinessMember"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Preserve account-wide deactivation when migrating to per-business status.
-- If a disabled account has memberships in several businesses, disable all of them.
UPDATE "BusinessMember" AS member
SET "isActive" = false
FROM "User" AS account
WHERE member."userId" = account."id"
  AND account."isActive" = false;

CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "firstFailureAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);
