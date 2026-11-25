-- DropIndex
DROP INDEX "Task_projectId_status_idx";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Task_projectId_status_position_idx" ON "Task"("projectId", "status", "position");

-- Keep today's order: number each column of the board as the old automatic sort did
-- (priority high first, then due date with none last, then oldest first).
UPDATE "Task" t SET "position" = ranked.n
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "projectId", "status"
    ORDER BY "priority" DESC, "dueDate" ASC NULLS LAST, "createdAt" ASC
  ) AS n
  FROM "Task"
  WHERE "parentId" IS NULL
) ranked
WHERE t.id = ranked.id;
