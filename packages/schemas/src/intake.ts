import { z } from "zod";

export const IntakeTradeTypeSchema = z.enum([
  "plumbing",
  "electrical",
  "furniture",
  "civil",
  "HVAC",
  "other",
]);

export const IntakeCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

export const IntakeLocationSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
});

/** Primary intake output (location included when identified). */
export const IntakeResultSchema = z.object({
  trade_type: IntakeTradeTypeSchema,
  job_type: z.string().optional(),
  language: z.string(),
  currency: z.string().length(3),
  location: IntakeLocationSchema.optional(),
  customer: IntakeCustomerSchema,
  summary: z.string(),
  detected_intent: z.enum([
    "new_proposal",
    "revise_estimate",
    "clarification",
    "upload_only",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
});

export type IntakeResult = z.infer<typeof IntakeResultSchema>;

export const AttachmentRefSchema = z.object({
  id: z.string().optional(),
  filename: z.string(),
  mime_type: z.string().optional(),
});
