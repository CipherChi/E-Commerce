ALTER TABLE "Sale" ADD COLUMN "receiptNumber" TEXT;
CREATE UNIQUE INDEX "Sale_receiptNumber_key" ON "Sale"("receiptNumber");
ALTER TABLE "SaleItem" ADD COLUMN "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "SaleItem" si SET "costPrice" = p."costPrice" FROM "Product" p WHERE p.id = si."productId";
CREATE TABLE "ExpenseCategory" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "name" TEXT NOT NULL, "isArchived" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Expense" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "categoryId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "description" TEXT, "expenseDate" DATE NOT NULL,
  "isArchived" BOOLEAN NOT NULL DEFAULT false, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExpenseCategory_businessId_name_key" ON "ExpenseCategory"("businessId", "name");
CREATE UNIQUE INDEX "ExpenseCategory_id_businessId_key" ON "ExpenseCategory"("id", "businessId");
CREATE INDEX "Expense_businessId_expenseDate_isArchived_idx" ON "Expense"("businessId", "expenseDate", "isArchived");
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_businessId_fkey" FOREIGN KEY ("categoryId", "businessId") REFERENCES "ExpenseCategory"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
