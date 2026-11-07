import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const apiRoot = path.dirname(fileURLToPath(import.meta.url));
const repoEnv = path.resolve(apiRoot, "../../.env");
const localEnv = path.resolve(apiRoot, ".env");
for (const envPath of [repoEnv, localEnv]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
