-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add_superadmin_role_and_user_fields
-- Changes:
--   1. Add SUPERADMIN value to the Role enum
--   2. Add updatedAt (NOT NULL) — backfilled from createdAt for existing rows
--   3. Add emailVerified (nullable)  — Auth.js compatibility
--   4. Add image (nullable)          — Auth.js compatibility
--   5. Add index on users(role)      — fast RBAC / admin panel queries
--   6. Add index on users(createdAt) — pagination / sorting by join date
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend the Role enum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- 2a. Add updatedAt with a temporary default so existing rows are backfilled
ALTER TABLE "users"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2b. Drop the server-side default — Prisma manages this via @updatedAt
ALTER TABLE "users"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- 3. Add nullable emailVerified (Auth.js email-verification timestamp)
ALTER TABLE "users"
  ADD COLUMN "emailVerified" TIMESTAMP(3);

-- 4. Add nullable image (Auth.js profile picture)
ALTER TABLE "users"
  ADD COLUMN "image" TEXT;

-- 5. Index on role for RBAC lookups
CREATE INDEX "users_role_idx" ON "users"("role");

-- 6. Index on createdAt for sorted pagination
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
