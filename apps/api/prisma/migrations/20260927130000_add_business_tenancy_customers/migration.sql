-- Create the initial tenant before adding required tenant keys to existing rows.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessMember_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Business" ("id", "name") VALUES ('default-business-migration', 'Default Business');
INSERT INTO "BusinessMember" ("id", "businessId", "userId", "role")
SELECT 'default-owner-' || "id", 'default-business-migration', "id", 'OWNER'
FROM "User"
WHERE "id" = (
  SELECT "id" FROM "User" ORDER BY CASE WHEN "role" = 'ADMIN' THEN 0 ELSE 1 END, "createdAt" LIMIT 1
);

ALTER TABLE "Property" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Room" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Guest" RENAME TO "Customer";
ALTER TABLE "Customer" RENAME CONSTRAINT "Guest_pkey" TO "Customer_pkey";
ALTER TABLE "Customer" RENAME COLUMN "fullName" TO "name";
ALTER TABLE "Booking" RENAME COLUMN "guestId" TO "customerId";
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_guestId_fkey" TO "Booking_customerId_fkey";
ALTER TABLE "Customer" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Customer" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Booking" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "businessId" TEXT;

UPDATE "Property" SET "businessId" = 'default-business-migration';
UPDATE "Room" SET "businessId" = 'default-business-migration';
UPDATE "Customer" SET "businessId" = 'default-business-migration';
UPDATE "Booking" SET "businessId" = 'default-business-migration';
UPDATE "Payment" SET "businessId" = 'default-business-migration';
UPDATE "Invoice" SET "businessId" = 'default-business-migration';

ALTER TABLE "Property" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Room" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "businessId" SET NOT NULL;

CREATE UNIQUE INDEX "BusinessMember_businessId_userId_key" ON "BusinessMember"("businessId", "userId");
CREATE INDEX "BusinessMember_userId_createdAt_idx" ON "BusinessMember"("userId", "createdAt");
CREATE INDEX "Property_businessId_idx" ON "Property"("businessId");
CREATE INDEX "Room_businessId_idx" ON "Room"("businessId");
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");
CREATE INDEX "Booking_businessId_idx" ON "Booking"("businessId");
CREATE INDEX "Payment_businessId_idx" ON "Payment"("businessId");
CREATE INDEX "Invoice_businessId_idx" ON "Invoice"("businessId");
CREATE UNIQUE INDEX "Property_id_businessId_key" ON "Property"("id", "businessId");
CREATE UNIQUE INDEX "Room_id_businessId_key" ON "Room"("id", "businessId");
CREATE UNIQUE INDEX "Customer_id_businessId_key" ON "Customer"("id", "businessId");
CREATE UNIQUE INDEX "Booking_id_businessId_key" ON "Booking"("id", "businessId");
CREATE UNIQUE INDEX "Invoice_bookingId_businessId_key" ON "Invoice"("bookingId", "businessId");

ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" DROP CONSTRAINT "Room_propertyId_fkey";
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_businessId_fkey" FOREIGN KEY ("propertyId", "businessId") REFERENCES "Property"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_roomId_fkey";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_businessId_fkey" FOREIGN KEY ("roomId", "businessId") REFERENCES "Room"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_customerId_fkey";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_businessId_fkey" FOREIGN KEY ("customerId", "businessId") REFERENCES "Customer"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_businessId_fkey" FOREIGN KEY ("bookingId", "businessId") REFERENCES "Booking"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_bookingId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_businessId_fkey" FOREIGN KEY ("bookingId", "businessId") REFERENCES "Booking"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
