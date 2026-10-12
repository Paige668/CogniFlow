-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill existing rows (hand-written).
-- OpenAI embeddings are unit-length. The old fallback stored uniform-random vectors in [0, 1],
-- whose length is about sqrt(1536 / 3) ≈ 22.6, so the norm tells real vectors from placeholders.
UPDATE "documents"
SET "status" = 'READY'
WHERE "embedding" IS NOT NULL AND abs(vector_norm("embedding") - 1) < 0.01;

UPDATE "documents"
SET "embedding" = NULL,
    "status" = 'FAILED',
    "error" = 'Stored vector was a random placeholder, not a real embedding. Delete and re-upload this document.'
WHERE "embedding" IS NOT NULL AND abs(vector_norm("embedding") - 1) >= 0.01;

UPDATE "documents"
SET "status" = 'FAILED',
    "error" = 'Document was never embedded. Delete and re-upload this document.'
WHERE "embedding" IS NULL AND "status" = 'PENDING';
