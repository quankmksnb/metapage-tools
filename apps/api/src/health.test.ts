import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("GET /health", () => {
  it("returns service status", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      service: "metapage-tools-api",
      graphApiVersion: "v25.0",
    });
    await app.close();
  });
});
