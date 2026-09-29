-- Preserve prior prices in the type-specific fields before changing the enum.
ALTER TABLE "Product" ADD COLUMN "normalRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "partyRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "Product" SET "normalRate" = "sellingPrice" WHERE "module"::text = 'LODGING';
UPDATE "Product" SET "monthlyPrice" = "sellingPrice" WHERE "module"::text = 'GYM';

-- Old combined food and beverage items become FOOD. Retail rows remain intact,
-- are archived, and are retyped FOOD so no data is lost when RETAIL is removed.
UPDATE "Product" SET "isArchived" = true WHERE "module"::text = 'RETAIL';
UPDATE "Product" SET "module" = 'FOOD_BEVERAGE' WHERE "module"::text = 'RETAIL';

-- Merge RETAIL module availability into the legacy food module before renaming it.
INSERT INTO "BusinessModule" ("id", "businessId", "module", "isEnabled", "enabledAt")
SELECT 'migrated-food-' || bm."businessId", bm."businessId", 'FOOD_BEVERAGE', bm."isEnabled", bm."enabledAt"
FROM "BusinessModule" bm WHERE bm."module"::text = 'RETAIL'
ON CONFLICT ("businessId", "module") DO UPDATE SET "isEnabled" = "BusinessModule"."isEnabled" OR EXCLUDED."isEnabled";
DELETE FROM "BusinessModule" WHERE "module"::text = 'RETAIL';

ALTER TYPE "BusinessModuleType" RENAME TO "BusinessModuleType_old";
CREATE TYPE "BusinessModuleType" AS ENUM ('LODGING', 'FOOD', 'BEVERAGE', 'GYM');
ALTER TABLE "Product" ALTER COLUMN "module" TYPE "BusinessModuleType" USING (CASE "module"::text WHEN 'FOOD_BEVERAGE' THEN 'FOOD' ELSE "module"::text END::"BusinessModuleType");
ALTER TABLE "BusinessModule" ALTER COLUMN "module" TYPE "BusinessModuleType" USING (CASE "module"::text WHEN 'FOOD_BEVERAGE' THEN 'FOOD' ELSE "module"::text END::"BusinessModuleType");
DROP TYPE "BusinessModuleType_old";
