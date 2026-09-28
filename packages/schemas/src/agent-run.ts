import { z } from "zod";

export const AgentRunStepSchema = z.enum([
  "intake",
  "gap",
  "clarification",
  "document_extract",
  "boq",
  "proposal_writer",
  "qa",
  "export",
]);

export const AgentRunSchema = z.object({
  run_id: z.string().uuid(),
  session_id: z.string().uuid(),
  org_id: z.string(),
  step: AgentRunStepSchema,
  model: z.string().optional(),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()),
  latency_ms: z.number().int().nonnegative(),
  created_at: z.string(),
});

export type AgentRunStep = z.infer<typeof AgentRunStepSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
