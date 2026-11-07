import { db } from "../db/index.js";
import { jobLogs } from "../db/schema.js";
import { redactForLog } from "./redact.js";

export type JobLogInput = {
  kind: string;
  refId?: string;
  request?: unknown;
  response?: unknown;
  httpStatus?: number;
  graphCode?: number;
  graphSubcode?: number;
  bucUsage?: unknown;
  durationMs: number;
};

export async function writeJobLog(input: JobLogInput): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await db.insert(jobLogs).values({
    kind: input.kind,
    refId: input.refId ?? null,
    request: redactForLog(input.request) as Record<string, unknown> | null,
    response: redactForLog(input.response) as Record<string, unknown> | null,
    httpStatus: input.httpStatus ?? null,
    graphCode: input.graphCode ?? null,
    graphSubcode: input.graphSubcode ?? null,
    bucUsage: (input.bucUsage ?? null) as Record<string, unknown> | null,
    durationMs: input.durationMs,
  });
}
