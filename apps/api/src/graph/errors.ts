export type GraphErrorCategory =
  | "RATE_LIMITED"
  | "TOKEN_INVALID"
  | "PERMISSION"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "TRANSIENT"
  | "FATAL";

export type GraphErrorBody = {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export type GraphErrorPayload = {
  error: GraphErrorBody;
};

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80003, 80004]);
const TOKEN_INVALID_CODES = new Set([190, 102, 463]);
const PERMISSION_CODES = new Set([10, 200, 294]);
const NOT_FOUND_CODES = new Set([803, 1705]);
const DUPLICATE_CODES = new Set([506, 1366051]);
const NO_RETRY_CODES = new Set([...TOKEN_INVALID_CODES, 100, 1705]);

export function classifyGraphError(
  code?: number,
  subcode?: number,
): GraphErrorCategory {
  if (code === undefined) return "TRANSIENT";
  if (RATE_LIMIT_CODES.has(code)) return "RATE_LIMITED";
  if (TOKEN_INVALID_CODES.has(code)) return "TOKEN_INVALID";
  if (PERMISSION_CODES.has(code)) return "PERMISSION";
  if (NOT_FOUND_CODES.has(code) || subcode === 33) return "NOT_FOUND";
  if (DUPLICATE_CODES.has(code)) return "DUPLICATE";
  if (NO_RETRY_CODES.has(code)) return "FATAL";
  return "TRANSIENT";
}

export function shouldRetryGraphError(
  code?: number,
  httpStatus?: number,
): boolean {
  if (httpStatus !== undefined && httpStatus >= 500) return true;
  if (code === undefined) return true;
  if (NO_RETRY_CODES.has(code)) return false;
  if (RATE_LIMIT_CODES.has(code)) return true;
  return classifyGraphError(code) === "TRANSIENT";
}

export class GraphApiError extends Error {
  readonly category: GraphErrorCategory;
  readonly code?: number;
  readonly subcode?: number;
  readonly httpStatus?: number;

  constructor(
    message: string,
    category: GraphErrorCategory,
    opts?: { code?: number; subcode?: number; httpStatus?: number },
  ) {
    super(message);
    this.name = "GraphApiError";
    this.category = category;
    this.code = opts?.code;
    this.subcode = opts?.subcode;
    this.httpStatus = opts?.httpStatus;
  }
}

export function graphErrorFromPayload(
  payload: GraphErrorPayload,
  httpStatus?: number,
): GraphApiError {
  const { message, code, error_subcode } = payload.error;
  const category = classifyGraphError(code, error_subcode);
  return new GraphApiError(message, category, {
    code,
    subcode: error_subcode,
    httpStatus,
  });
}
