import { z } from "zod";

export const TradeSchema = z.enum([
  "plumbing",
  "electrical",
  "hvac",
  "general",
]);

export const SessionStatusSchema = z.enum([
  "idle",
  "uploading",
  "analysing",
  "asking_questions",
  "generating",
  "review",
  "share",
  "failed",
]);

export const GapItemSchema = z.object({
  field_id: z.string(),
  severity: z.enum(["blocking", "recommended"]),
  question: z.string(),
  suggested_default: z.unknown().optional(),
});

export const ReadinessSchema = z.object({
  can_generate: z.boolean(),
  blocking_missing: z.array(z.string()),
});

export const SessionContextSchema = z.object({
  session_id: z.string().uuid(),
  org_id: z.string(),
  trade: TradeSchema.optional(),
  job_type: z.string().optional(),
  locale: z.string().default("en-US"),
  currency: z.string().length(3),
  site: z
    .object({
      address: z.string().optional(),
      access_notes: z.string().optional(),
      photos_count: z.number().int().nonnegative().optional(),
    })
    .optional(),
  customer: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  requirements: z.record(z.unknown()).default({}),
  gaps: z.array(GapItemSchema).default([]),
  readiness: ReadinessSchema.optional(),
});

export type SessionContext = z.infer<typeof SessionContextSchema>;
