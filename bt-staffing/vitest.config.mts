import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  // DB-backed tests run only when DATABASE_URL_TEST is set, and only ever
  // touch that database.
  const testDb = env.DATABASE_URL_TEST ?? "";
  return {
    resolve: { alias: { "@": path.resolve(here, "src") } },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      fileParallelism: false,
      globalSetup: ["tests/global-setup.ts"],
      env: {
        DATABASE_URL: testDb,
        DATABASE_URL_TEST: testDb,
        HUBSPOT_MODE: "mock",
        SALESMSG_MODE: "mock",
        WORKDAY_MODE: "mock",
        APPLOI_MODE: "mock",
        REQUIRE_WORKDAY_HIRE: "true",
      },
    },
  };
});
