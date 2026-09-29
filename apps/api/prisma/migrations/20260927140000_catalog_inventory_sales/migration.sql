CREATE TYPE "CatalogItemType" AS ENUM ('ROOM', 'SERVICE', 'PRODUCT');
CREATE TYPE "StockMovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT');
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SalePaymentStatus" AS ENUM ('PAID', 'PARTIAL', 'UNPAID');

CREATE TABLE "CatalogCategory" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "name" TEXT NOT NULL,
  CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CatalogCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CatalogCategory_businessId_name_key" ON "CatalogCategory"("businessId", "name");
CREATE UNIQUE INDEX "CatalogCategory_id_businessId_key" ON "CatalogCategory"("id", "businessId");

CREATE TABLE "Product" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "categoryId" TEXT, "name" TEXT NOT NULL,
  "type" "CatalogItemType" NOT NULL, "costPrice" DECIMAL(12,2) NOT NULL, "sellingPrice" DECIMAL(12,2) NOT NULL,
  "isStockable" BOOLEAN NOT NULL DEFAULT false, "lowStockThreshold" INTEGER, "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Product_categoryId_businessId_fkey" FOREIGN KEY ("categoryId", "businessId") REFERENCES "CatalogCategory"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Product_room_not_stockable" CHECK ("type" <> 'ROOM' OR "isStockable" = false),
  CONSTRAINT "Product_prices_nonnegative" CHECK ("costPrice" >= 0 AND "sellingPrice" >= 0),
  CONSTRAINT "Product_threshold_nonnegative" CHECK ("lowStockThreshold" IS NULL OR "lowStockThreshold" >= 0),
  CONSTRAINT "Product_threshold_only_stockable" CHECK ("isStockable" OR "lowStockThreshold" IS NULL)
);
CREATE UNIQUE INDEX "Product_id_businessId_key" ON "Product"("id", "businessId");
CREATE INDEX "Product_businessId_type_isArchived_idx" ON "Product"("businessId", "type", "isArchived");

CREATE TABLE "Sale" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "customerId" TEXT, "guestName" TEXT,
  "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED', "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "SalePaymentStatus" NOT NULL, "subtotal" DECIMAL(12,2) NOT NULL, "total" DECIMAL(12,2) NOT NULL,
  "amountPaid" DECIMAL(12,2) NOT NULL, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Sale_customerId_businessId_fkey" FOREIGN KEY ("customerId", "businessId") REFERENCES "Customer"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Sale_id_businessId_key" UNIQUE ("id", "businessId"),
  CONSTRAINT "Sale_amounts_nonnegative" CHECK ("subtotal" >= 0 AND "total" >= 0 AND "amountPaid" >= 0 AND "amountPaid" <= "total")
);
CREATE INDEX "Sale_businessId_createdAt_status_idx" ON "Sale"("businessId", "createdAt", "status");

CREATE TABLE "SaleItem" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "saleId" TEXT NOT NULL, "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(12,2) NOT NULL, "lineSubtotal" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleItem_saleId_businessId_fkey" FOREIGN KEY ("saleId", "businessId") REFERENCES "Sale"("id", "businessId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleItem_productId_businessId_fkey" FOREIGN KEY ("productId", "businessId") REFERENCES "Product"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleItem_quantity_positive" CHECK ("quantity" > 0)
);
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "productId" TEXT NOT NULL, "saleId" TEXT,
  "type" "StockMovementType" NOT NULL, "quantity" INTEGER NOT NULL, "reason" TEXT, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_productId_businessId_fkey" FOREIGN KEY ("productId", "businessId") REFERENCES "Product"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_saleId_businessId_fkey" FOREIGN KEY ("saleId", "businessId") REFERENCES "Sale"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_quantity_check" CHECK (("type" = 'STOCK_IN' AND "quantity" > 0) OR ("type" = 'STOCK_OUT' AND "quantity" < 0) OR ("type" = 'ADJUSTMENT' AND "quantity" <> 0)),
  CONSTRAINT "StockMovement_adjustment_reason" CHECK ("type" <> 'ADJUSTMENT' OR NULLIF(BTRIM("reason"), '') IS NOT NULL)
);
CREATE INDEX "StockMovement_businessId_productId_createdAt_idx" ON "StockMovement"("businessId", "productId", "createdAt");
CREATE INDEX "StockMovement_saleId_idx" ON "StockMovement"("saleId");
