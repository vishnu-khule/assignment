import { ScopePlanSchema } from "@proposal/schemas";
import type { ScopePlan, SessionContext } from "@proposal/schemas";
import { completeChat, getOpenAI, primaryModel } from "./client.js";

export async function planScopeWithLlm(
  context: SessionContext,
  ragSnippets: string[],
): Promise<ScopePlan | null> {
  if (!getOpenAI()) return null;

  const text = await completeChat({
    model: primaryModel(),
    max_tokens: 4096,
    system: `You are the Scope Planner. Output ONLY JSON for ScopePlan schema.
Line items must include quantity, unit, labor_hours, tier_eligibility — NO prices.`,
    user: JSON.stringify({
      context,
      reference_snippets: ragSnippets.slice(0, 12),
    }),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return ScopePlanSchema.parse(JSON.parse(jsonMatch[0]));
}
