import { env } from "../config.js";
import {
  GraphApiError,
  type GraphErrorPayload,
  graphErrorFromPayload,
  shouldRetryGraphError,
} from "./errors.js";
import { writeJobLog } from "./job-log.js";
import { appSecretProof } from "./proof.js";
import { redactForLog } from "./redact.js";

const GRAPH_ORIGIN = "https://graph.facebook.com";
const USER_AGENT = "metapage-tools-api/0.0.1";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 4;

export type GraphQuery = Record<string, string | number | boolean | undefined>;

export type GraphRequestOptions = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  accessToken: string;
  query?: GraphQuery;
  body?: Record<string, unknown>;
  kind: string;
  refId?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = 500 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

function buildUrl(path: string, accessToken: string, query?: GraphQuery): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${GRAPH_ORIGIN}/${env.GRAPH_VERSION}${normalized}`);
  url.searchParams.set("appsecret_proof", appSecretProof(accessToken));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

function parseUsageHeaders(headers: Headers): {
  bucUsage: Record<string, unknown> | undefined;
  highUsage: boolean;
} {
  const bucUsage: Record<string, unknown> = {};
  for (const name of ["x-business-use-case-usage", "x-app-usage"] as const) {
    const raw = headers.get(name);
    if (!raw) continue;
    try {
      bucUsage[name] = JSON.parse(raw) as unknown;
    } catch {
      bucUsage[name] = raw;
    }
  }
  const highUsage = checkHighUsage(bucUsage);
  return {
    bucUsage: Object.keys(bucUsage).length > 0 ? bucUsage : undefined,
    highUsage,
  };
}

function checkHighUsage(usage: Record<string, unknown>): boolean {
  const text = JSON.stringify(usage);
  const ratios = [...text.matchAll(/"call_count"\s*:\s*(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  return ratios.some((n) => n >= 80);
}

async function graphRequest<T extends Record<string, unknown>>(
  options: GraphRequestOptions,
): Promise<T> {
  const started = Date.now();
  const url = buildUrl(options.path, options.accessToken, options.query);
  const logRequest = {
    method: options.method,
    path: options.path,
    query: redactForLog(options.query),
    body: options.body ? redactForLog(options.body) : undefined,
  };

  let lastError: GraphApiError | undefined;
  let lastHttpStatus: number | undefined;
  let lastBody: unknown;
  let bucUsage: Record<string, unknown> | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: options.method,
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "User-Agent": USER_AGENT,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      lastHttpStatus = res.status;
      const usage = parseUsageHeaders(res.headers);
      bucUsage = usage.bucUsage;
      if (usage.highUsage) {
        console.warn("[graph] rate usage >= 80%", {
          kind: options.kind,
          bucUsage,
        });
      }

      const json = (await res.json()) as T & GraphErrorPayload;
      lastBody = json;

      if ("error" in json && json.error) {
        const err = graphErrorFromPayload(
          json as GraphErrorPayload,
          res.status,
        );
        lastError = err;
        if (
          attempt < MAX_ATTEMPTS - 1 &&
          shouldRetryGraphError(err.code, res.status)
        ) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw err;
      }

      if (res.status >= 500 && attempt < MAX_ATTEMPTS - 1) {
        await sleep(backoffMs(attempt));
        continue;
      }

      await writeJobLog({
        kind: options.kind,
        refId: options.refId,
        request: logRequest,
        response: json,
        httpStatus: res.status,
        bucUsage,
        durationMs: Date.now() - started,
      });

      return json as T;
    } catch (e) {
      if (e instanceof GraphApiError) {
        if (
          attempt < MAX_ATTEMPTS - 1 &&
          shouldRetryGraphError(e.code, e.httpStatus)
        ) {
          await sleep(backoffMs(attempt));
          continue;
        }
        await writeJobLog({
          kind: options.kind,
          refId: options.refId,
          request: logRequest,
          response: lastBody ?? { message: e.message },
          httpStatus: lastHttpStatus,
          graphCode: e.code,
          graphSubcode: e.subcode,
          bucUsage,
          durationMs: Date.now() - started,
        });
        throw e;
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(backoffMs(attempt));
        continue;
      }
      await writeJobLog({
        kind: options.kind,
        refId: options.refId,
        request: logRequest,
        response: { message: e instanceof Error ? e.message : "network_error" },
        httpStatus: lastHttpStatus,
        bucUsage,
        durationMs: Date.now() - started,
      });
      throw e;
    }
  }

  const fallback =
    lastError ??
    new GraphApiError("Graph request failed", "TRANSIENT", {
      httpStatus: lastHttpStatus,
    });
  throw fallback;
}

export function graphGet<T extends Record<string, unknown>>(
  path: string,
  accessToken: string,
  query?: GraphQuery,
  kind = "graph_get",
): Promise<T> {
  return graphRequest<T>({ method: "GET", path, accessToken, query, kind });
}

export function graphPost<T extends Record<string, unknown>>(
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
  query?: GraphQuery,
  kind = "graph_post",
): Promise<T> {
  return graphRequest<T>({
    method: "POST",
    path,
    accessToken,
    body,
    query,
    kind,
  });
}

export function graphDelete<T extends Record<string, unknown>>(
  path: string,
  accessToken: string,
  query?: GraphQuery,
  kind = "graph_delete",
): Promise<T> {
  return graphRequest<T>({ method: "DELETE", path, accessToken, query, kind });
}
