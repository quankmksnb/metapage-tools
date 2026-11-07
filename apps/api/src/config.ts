import { z } from "zod";

const base64Key32 = z.string().refine(
  (s) => {
    try {
      return Buffer.from(s, "base64").length === 32;
    } catch {
      return false;
    }
  },
  {
    message:
      "TOKEN_ENC_KEY must be 32 bytes when base64-decoded (run: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\")",
  },
);

const boolEnv = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((v) => {
    if (v === undefined) return false;
    if (typeof v === "boolean") return v;
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url(),
  /** Origin admin UI (CORS + cookie cross-port dev). */
  WEB_ORIGIN: z.string().url().optional().default("http://localhost:3001"),
  META_APP_ID: z.string().min(1, "META_APP_ID is required"),
  META_APP_SECRET: z.string().min(1, "META_APP_SECRET is required"),
  META_VERIFY_TOKEN: z.string().min(1, "META_VERIFY_TOKEN is required"),
  GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/, "GRAPH_VERSION must look like v25.0")
    .default("v25.0"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (u) => u.startsWith("postgresql://") || u.startsWith("postgres://"),
      {
        message: "DATABASE_URL must be a Postgres connection string",
      },
    ),
  TOKEN_ENC_KEY: base64Key32,
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  ADMIN_EMAILS: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    ),
  /** Login for Business: copy Configuration ID. App use case Page: để trống, dùng META_OAUTH_SCOPES. */
  META_OAUTH_CONFIG_ID: z.string().optional().default(""),
  /** App "Quản lý mọi thứ trên Trang" — scope OAuth (phân tách dấu phẩy). */
  META_OAUTH_SCOPES: z.string().optional().default(""),
  WORKER_ENABLED: boolEnv,
  AUTO_REPLY_ENABLED: boolEnv,
});

function loadEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
