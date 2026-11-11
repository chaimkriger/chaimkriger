import { execSync } from "node:child_process";
import { loadEnv } from "vite";

export default function setup() {
  const env = { ...loadEnv("test", process.cwd(), ""), ...process.env };
  const url = env.DATABASE_URL_TEST;
  if (!url) {
    console.warn("\nDATABASE_URL_TEST is not set: database-backed tests will be skipped.\n");
    return;
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
