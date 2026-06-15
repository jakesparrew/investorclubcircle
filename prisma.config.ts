// Prisma 7 does NOT auto-load .env — load it ourselves. Next.js uses .env.local
// for local secrets, so load that first (it wins), then fall back to .env.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  // Migration / introspection commands use the DIRECT (non-pooled) connection.
  // The runtime client uses the pooled DATABASE_URL from the schema datasource.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
