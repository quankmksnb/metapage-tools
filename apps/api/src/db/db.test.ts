import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, db, pingDb } from "./index.js";

afterAll(async () => {
  await closeDb();
});

describe("database", () => {
  it("pings postgres", async () => {
    await expect(pingDb()).resolves.toBeUndefined();
  });

  it("has core tables after migrate", async () => {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'pages'
    `);
    expect(result.rows.length).toBe(1);
  });
});
