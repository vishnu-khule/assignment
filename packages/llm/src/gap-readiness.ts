import {
  GapReadinessResultSchema,
  type GapReadinessResult,
  type TradeChecklistField,
} from "@proposal/schemas";
import { completeChat, fastModel, getOpenAI, primaryModel } from "./client.js";
import {
  evaluateGapReadiness,
  reconcileGapMissing,
} from "./gap-readiness-heuristic.js";

export const GAP_READINESS_SYSTEM_PROMPT = `Given the trade checklist {checklist} and the extracted data {data}, list which
REQUIRED fields are still missing or ambiguous (e.g. area in sqm, material
grade, site access, deadline, budget range). Rank by impact on price. Return:
{ready_to_generate: boolean, missing: [{field, why_needed, question, priority}]}.
Only list fields that are truly missing from {data} — never ask for area, address, or scope already stated in user_message, requirements, or extracted documents.
Keep them short and plain-language.

Rules:
- Only include REQUIRED checklist fields that are missing or ambiguous in {data}.
- priority: integer 1 (highest price impact) to 5 (lowest).
- Sort missing by priority ascending.
- Return all still-missing required fields (sorted by priority); the app asks one at a time.
- ready_to_generate is true only when no required field is missing or ambiguous.
- Do not invent values; infer from data only when clearly stated.
- Output JSON only, no markdown.`;

/** Use Sonnet when files, chunks, or LLM extractions are in play. */
export async function analyzeGapReadiness(
  checklist: TradeChecklistField[],
  data: Record<string, unknown>,
  useDeepAnalysis: boolean,
): Promise<GapReadinessResult> {
  if (!getOpenAI()) {
    return evaluateGapReadiness(checklist, data);
  }

  const model = useDeepAnalysis ? primaryModel() : fastModel();

  const text = await completeChat({
    model,
    max_tokens: 2048,
    system: GAP_READINESS_SYSTEM_PROMPT.replace("{checklist}", "checklist").replace(
      "{data}",
      "data",
    ),
    user: JSON.stringify({ checklist, data }),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return evaluateGapReadiness(checklist, data);
  }

  try {
    const parsed = GapReadinessResultSchema.parse(JSON.parse(jsonMatch[0]));
    const sorted = [...parsed.missing].sort((a, b) => a.priority - b.priority);
    return reconcileGapMissing(
      { ready_to_generate: parsed.ready_to_generate, missing: sorted },
      checklist,
      data,
    );
  } catch {
    return evaluateGapReadiness(checklist, data);
  }
}
