CREATE TYPE "BusinessType" AS ENUM ('HOTEL', 'APARTMENT', 'RESTAURANT', 'GYM', 'SUPERMARKET');
CREATE TYPE "BusinessModuleType" AS ENUM ('LODGING', 'FOOD_BEVERAGE', 'GYM', 'RETAIL');
ALTER TABLE "Business" ADD COLUMN "primaryType" "BusinessType" NOT NULL DEFAULT 'HOTEL';
CREATE TABLE "BusinessModule" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "module" "BusinessModuleType" NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessModule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessModule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BusinessModule_businessId_module_key" ON "BusinessModule"("businessId", "module");
CREATE INDEX "BusinessModule_businessId_isEnabled_idx" ON "BusinessModule"("businessId", "isEnabled");
-- Existing single-vertical tenants are migrated using their catalog's legacy item type.
INSERT INTO "BusinessModule" ("id", "businessId", "module", "isEnabled")
SELECT 'module-' || b."id" || '-' || m."module", b."id", m."module", true
FROM "Business" b
JOIN (SELECT DISTINCT "businessId", CASE "type"::text WHEN 'ROOM' THEN 'LODGING' WHEN 'SERVICE' THEN 'FOOD_BEVERAGE' ELSE 'RETAIL' END::"BusinessModuleType" AS "module" FROM "Product") m ON m."businessId" = b."id"
ON CONFLICT ("businessId", "module") DO NOTHING;
INSERT INTO "BusinessModule" ("id", "businessId", "module", "isEnabled")
SELECT 'module-' || b."id" || '-LODGING', b."id", 'LODGING', true FROM "Business" b
WHERE NOT EXISTS (SELECT 1 FROM "BusinessModule" bm WHERE bm."businessId"=b."id");
ALTER TABLE "Product" ADD COLUMN "module" "BusinessModuleType";
UPDATE "Product" SET "module" = (CASE "type"::text WHEN 'ROOM' THEN 'LODGING' WHEN 'SERVICE' THEN 'FOOD_BEVERAGE' ELSE 'RETAIL' END)::"BusinessModuleType";
ALTER TABLE "Product" ALTER COLUMN "module" SET NOT NULL;
ALTER TABLE "Product" ADD COLUMN "category" TEXT;
UPDATE "Product" p SET "category"=c."name" FROM "CatalogCategory" c WHERE p."categoryId"=c."id" AND p."businessId"=c."businessId";
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_businessId_fkey";
ALTER TABLE "Product" DROP COLUMN "categoryId";
ALTER TABLE "Product" DROP CONSTRAINT "Product_room_not_stockable";
ALTER TABLE "Product" DROP COLUMN "type";
DROP TYPE "CatalogItemType";
CREATE INDEX "Product_businessId_module_isArchived_idx" ON "Product"("businessId", "module", "isArchived");
