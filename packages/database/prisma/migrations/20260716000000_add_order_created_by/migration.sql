-- Add createdBy field to Order table
ALTER TABLE "Order" ADD COLUMN "createdBy" TEXT;

-- Add foreign key constraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- Create index for createdBy
CREATE INDEX "Order_createdBy_idx" ON "Order"("createdBy");