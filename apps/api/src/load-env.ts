import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
/** Root monorepo trước; `apps/api/.env` ghi đè nếu có. */
const candidates = [
  path.resolve(srcDir, "../../../.env"),
  path.resolve(srcDir, "../../.env"),
];

for (const envPath of candidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}
