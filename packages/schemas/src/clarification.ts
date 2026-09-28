import { z } from "zod";

export const QuickReplySchema = z.object({
  label: z.string(),
  /** Sent as user message and parsed into requirements */
  value: z.string(),
  field: z.string().optional(),
});

export const ClarificationTurnSchema = z.object({
  message: z.string(),
  quick_replies: z.array(QuickReplySchema),
});

export type QuickReply = z.infer<typeof QuickReplySchema>;
export type ClarificationTurn = z.infer<typeof ClarificationTurnSchema>;

export const DocumentedAssumptionSchema = z.object({
  field: z.string(),
  assumed_value: z.string(),
  reason: z.string(),
});

export type DocumentedAssumption = z.infer<typeof DocumentedAssumptionSchema>;
