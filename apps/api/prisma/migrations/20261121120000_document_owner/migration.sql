-- AlterTable (hand-written backfill).
-- Documents uploaded before sign-in existed have no owner. They get the placeholder owner
-- 'legacy-unowned', which no Clerk user ID can equal (Clerk IDs start with 'user_'), so no one
-- can read or search them. Delete them, or reassign one with
--   UPDATE "documents" SET "userId" = 'user_...' WHERE "userId" = 'legacy-unowned';
ALTER TABLE "documents" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'legacy-unowned';
ALTER TABLE "documents" ALTER COLUMN "userId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "documents_userId_createdAt_idx" ON "documents"("userId", "createdAt");
