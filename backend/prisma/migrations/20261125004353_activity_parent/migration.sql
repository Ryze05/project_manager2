-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "parentId" UUID;

-- CreateIndex
CREATE INDEX "Activity_parentId_createdAt_idx" ON "Activity"("parentId", "createdAt" DESC);

-- Events already written: take the parent from the task, when it still exists.
UPDATE "Activity" a SET "parentId" = t."parentId" FROM "Task" t WHERE a."taskId" = t.id AND t."parentId" IS NOT NULL;
