import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.js";
import { db } from "../db/index.js";
import { commentRules } from "../db/schema.js";
import { commentMatchesRule, pickReplyTemplate } from "../rules/match.js";
import { getPageTokenForAccount } from "../services/meta-oauth.js";

const ruleBody = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(0),
  matchType: z.enum(["contains", "regex", "exact"]).default("contains"),
  pattern: z.string().min(1).max(500),
  caseSensitive: z.boolean().default(false),
  replyTemplates: z.array(z.string().min(1).max(2000)).min(1).max(20),
  replyMode: z.enum(["public", "private", "hide", "like"]).default("public"),
  cooldownSeconds: z.number().int().min(0).max(86400).default(60),
  maxPerUserPerDay: z.number().int().min(0).max(1000).default(5),
});

export async function registerRulesRoutes(app: FastifyInstance) {
  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/rules",
    async (req, reply) => {
      const { error, session } = requireSession(req);
      if (error || !session) {
        return reply
          .code(401)
          .send({ error: "login_required", login: "/auth/meta" });
      }
      const tokenRow = await getPageTokenForAccount(
        session.accountId,
        req.params.pageId,
      );
      if (!tokenRow) {
        return reply.code(404).send({ error: "page_not_found" });
      }
      const rules = await db
        .select()
        .from(commentRules)
        .where(eq(commentRules.pageId, req.params.pageId))
        .orderBy(asc(commentRules.priority));
      return { rules };
    },
  );

  app.post<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/rules",
    async (req, reply) => {
      const { error, session } = requireSession(req);
      if (error || !session) {
        return reply
          .code(401)
          .send({ error: "login_required", login: "/auth/meta" });
      }
      const parsed = ruleBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const tokenRow = await getPageTokenForAccount(
        session.accountId,
        req.params.pageId,
      );
      if (!tokenRow) {
        return reply.code(404).send({ error: "page_not_found" });
      }
      const [row] = await db
        .insert(commentRules)
        .values({
          pageId: req.params.pageId,
          ...parsed.data,
        })
        .returning();
      return { rule: row };
    },
  );

  app.post<{
    Params: { pageId: string; ruleId: string };
    Body: { sampleText?: string };
  }>("/api/pages/:pageId/rules/:ruleId/test", async (req, reply) => {
    const { error, session } = requireSession(req);
    if (error || !session) {
      return reply
        .code(401)
        .send({ error: "login_required", login: "/auth/meta" });
    }
    const [rule] = await db
      .select()
      .from(commentRules)
      .where(
        and(
          eq(commentRules.id, req.params.ruleId),
          eq(commentRules.pageId, req.params.pageId),
        ),
      )
      .limit(1);
    if (!rule) {
      return reply.code(404).send({ error: "rule_not_found" });
    }
    const sample = req.body?.sampleText ?? rule.pattern;
    const matches = commentMatchesRule(
      sample,
      rule.matchType,
      rule.pattern,
      rule.caseSensitive,
    );
    return {
      matches,
      replyWouldBe: matches
        ? pickReplyTemplate(rule.replyTemplates, sample)
        : null,
      dryRun: true,
    };
  });
}
