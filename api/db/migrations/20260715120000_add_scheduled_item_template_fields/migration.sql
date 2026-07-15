-- AlterTable
ALTER TABLE "ScheduledItem" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateId" TEXT;

-- CreateIndex
CREATE INDEX "ScheduledItem_isTemplate_idx" ON "ScheduledItem"("isTemplate");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledItem_templateId_scheduledAt_key" ON "ScheduledItem"("templateId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "ScheduledItem" ADD CONSTRAINT "ScheduledItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScheduledItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

