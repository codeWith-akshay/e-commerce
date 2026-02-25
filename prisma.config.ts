import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma.config.ts — Prisma 7 configuration
// DATABASE_URL  — pooler URL, used by PrismaClient at runtime
// DIRECT_URL    — non-pooler URL, required by Prisma Migrate / shadow DB on Neon
// See: https://pris.ly/d/config-datasource

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL as string,   // direct URL for migrate + shadow DB
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
