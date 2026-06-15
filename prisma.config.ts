// Prisma 7 does NOT auto-load .env — load it ourselves. Next.js uses .env.local
// for local secrets, so load that first (it wins), then fall back to .env.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  // Migration/introspection use the DIRECT connection. Read straight from
  // process.env (not the throwing env() helper) so `prisma generate` works on
  // Vercel even before DIRECT_URL is set.
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
