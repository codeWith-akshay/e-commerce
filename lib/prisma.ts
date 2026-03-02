import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ─────────────────────────────────────────────────────────────────────────────
// PrismaClient Singleton  (Prisma 7 + pg driver adapter)
//
// In development, Next.js hot-reload creates new module instances on each
// code change, which would spawn multiple PrismaClient connections and exhaust
// the database connection pool.
//
// Solution: attach the client to `globalThis` so it survives HMR reloads.
// In production, we always create a fresh instance (no HMR).
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // pg-connection-string treats 'require' as an alias for 'verify-full'; replace
  // it explicitly to silence the upcoming breaking-change warning in pg v9.
  const rawUrl = process.env.DATABASE_URL!;
  const connectionString = rawUrl.replace(/sslmode=require/gi, "sslmode=verify-full");

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
