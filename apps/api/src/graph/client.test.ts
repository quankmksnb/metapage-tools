import { afterEach, describe, expect, it, vi } from "vitest";
import { graphGet, graphPost } from "./client.js";
import { GraphApiError } from "./errors.js";

const token = "test-page-token";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("graph client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends Bearer auth and appsecret_proof without access_token query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await graphGet("/me", token, undefined, "test_get");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("appsecret_proof=");
    expect(url).not.toContain("access_token=");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${token}`,
    });
  });

  it("retries transient 5xx then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: "err", code: 1 } }, 500),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = graphPost<{ id: string }>(
      "/123/comments",
      token,
      { message: "hi" },
      undefined,
      "test_retry",
    );
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.id).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry token invalid (190)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        error: {
          message: "Invalid OAuth access token",
          code: 190,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      graphPost(
        "/123/comments",
        token,
        { message: "hi" },
        undefined,
        "test_no_retry",
      ),
    ).rejects.toBeInstanceOf(GraphApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
