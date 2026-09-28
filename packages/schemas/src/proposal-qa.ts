import { z } from "zod";

export const ProposalQaIssueSchema = z.object({
  severity: z.enum(["error", "warning"]),
  location: z.string(),
  fix: z.string(),
});

export const ProposalQaResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(ProposalQaIssueSchema),
});

export type ProposalQaIssue = z.infer<typeof ProposalQaIssueSchema>;
export type ProposalQaResult = z.infer<typeof ProposalQaResultSchema>;
