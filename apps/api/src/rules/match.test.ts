import { describe, expect, it } from "vitest";
import { commentMatchesRule, pickReplyTemplate } from "./match.js";

describe("commentMatchesRule", () => {
  it("contains match", () => {
    expect(commentMatchesRule("xin chào shop", "contains", "chào", false)).toBe(
      true,
    );
  });

  it("exact match", () => {
    expect(commentMatchesRule("hi", "exact", "hi", true)).toBe(true);
  });
});

describe("pickReplyTemplate", () => {
  it("rotates by seed", () => {
    const templates = ["a", "b", "c"];
    expect(pickReplyTemplate(templates, "x1")).toBeTruthy();
  });
});
