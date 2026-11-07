import { describe, expect, it } from "vitest";
import { classifyGraphError, shouldRetryGraphError } from "./errors.js";

describe("graph errors", () => {
  it("classifies rate limit", () => {
    expect(classifyGraphError(80001)).toBe("RATE_LIMITED");
  });

  it("classifies token invalid", () => {
    expect(classifyGraphError(190)).toBe("TOKEN_INVALID");
  });

  it("does not retry fatal parameter errors", () => {
    expect(shouldRetryGraphError(100)).toBe(false);
    expect(shouldRetryGraphError(190)).toBe(false);
  });

  it("retries rate limits", () => {
    expect(shouldRetryGraphError(17)).toBe(true);
    expect(shouldRetryGraphError(undefined, 503)).toBe(true);
  });
});
