import { z } from "zod";

export const TradeChecklistFieldSchema = z.object({
  field: z.string(),
  required: z.boolean(),
  why_needed: z.string(),
  question: z.string(),
  /** 1 = highest impact on price; 5 = lowest */
  priority: z.number().int().min(1).max(5),
});

export const GapReadinessResultSchema = z.object({
  ready_to_generate: z.boolean(),
  missing: z.array(
    z.object({
      field: z.string(),
      why_needed: z.string(),
      question: z.string(),
      priority: z.number().int().min(1).max(5),
    }),
  ),
});

export type TradeChecklistField = z.infer<typeof TradeChecklistFieldSchema>;
export type GapReadinessResult = z.infer<typeof GapReadinessResultSchema>;
