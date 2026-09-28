import {
  ClarificationTurnSchema,
  type ClarificationTurn,
  type GapReadinessResult,
} from "@proposal/schemas";
import { completeChat, fastModel, getOpenAI } from "./client.js";

export const CLARIFICATION_SYSTEM_PROMPT = `You are a friendly assistant talking to a busy tradesperson. Ask the
questions from {missing} in a short, simple way, offering quick-reply options
when possible. Do not generate any proposal until ready_to_generate is true or
the user says "generate with assumptions". If assumptions are used, list them
explicitly.

Output JSON only:
{ "message": string, "quick_replies": [{ "label": string, "value": string, "field": string optional }] }
- message: 1-3 short sentences, plain language, no jargon.
- quick_replies: 2-4 tappable options per question when sensible; value should be "field: answer" format.
- Ask exactly ONE question — the highest-priority missing field only.
- quick_replies: 2-4 options for that single question only.
- Do not mention generating proposals if ready_to_generate is false.`;

const QUICK_BY_FIELD: Record<string, ClarificationTurn["quick_replies"]> = {
  material_grade: [
    { label: "Economy", value: "material_grade: economy", field: "material_grade" },
    { label: "Standard", value: "material_grade: standard", field: "material_grade" },
    { label: "Premium", value: "material_grade: premium", field: "material_grade" },
  ],
  system_type: [
    { label: "Repair", value: "system_type: repair", field: "system_type" },
    {
      label: "Full replacement",
      value: "system_type: full replacement",
      field: "system_type",
    },
  ],
  panel_capacity: [
    { label: "100A", value: "panel_capacity: 100A", field: "panel_capacity" },
    { label: "200A", value: "panel_capacity: 200A", field: "panel_capacity" },
    { label: "Not sure", value: "panel_capacity: unknown", field: "panel_capacity" },
  ],
  area_sqm: [
    {
      label: "About 200 sq ft (10×20)",
      value: "area_dimensions: 10x20 ft",
      field: "area_sqm",
    },
    {
      label: "About 150 sq ft",
      value: "area_sqft: 150",
      field: "area_sqm",
    },
    {
      label: "I'll specify in chat",
      value: "area_sqm: ",
      field: "area_sqm",
    },
  ],
  deadline: [
    { label: "ASAP", value: "deadline: ASAP", field: "deadline" },
    { label: "1–2 weeks", value: "deadline: 1-2 weeks", field: "deadline" },
    { label: "Flexible", value: "deadline: flexible", field: "deadline" },
  ],
  site_access: [
    {
      label: "Easy access",
      value: "site_access: normal business hours",
      field: "site_access",
    },
    {
      label: "Limited access",
      value: "site_access: limited — stairs or restricted hours",
      field: "site_access",
    },
  ],
};

export function formatClarificationHeuristic(
  gap: GapReadinessResult,
): ClarificationTurn {
  if (gap.ready_to_generate || gap.missing.length === 0) {
    return ClarificationTurnSchema.parse({
      message:
        "Looks good — I can build Basic, Modern, and Premium options. Tap Generate when you want them.",
      quick_replies: [],
    });
  }

  const next = gap.missing[0];
  if (!next) {
    return formatClarificationHeuristic({
      ready_to_generate: true,
      missing: [],
    });
  }

  const quick_replies = QUICK_BY_FIELD[next.field] ?? [
    {
      label: "I'll type it in chat",
      value: `${next.field}: `,
      field: next.field,
    },
  ];

  return ClarificationTurnSchema.parse({
    message: next.question,
    quick_replies: quick_replies.slice(0, 4),
  });
}

export async function formatClarification(
  gap: GapReadinessResult,
): Promise<ClarificationTurn> {
  if (gap.ready_to_generate) {
    return formatClarificationHeuristic(gap);
  }

  if (!getOpenAI()) {
    return formatClarificationHeuristic(gap);
  }

  const nextMissing = gap.missing.slice(0, 1);

  const text = await completeChat({
    model: fastModel(),
    max_tokens: 512,
    system: CLARIFICATION_SYSTEM_PROMPT.replace("{missing}", "missing"),
    user: JSON.stringify({
      missing: nextMissing,
      ready_to_generate: gap.ready_to_generate,
    }),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return formatClarificationHeuristic(gap);
  }

  try {
    return ClarificationTurnSchema.parse(JSON.parse(jsonMatch[0]));
  } catch {
    return formatClarificationHeuristic(gap);
  }
}
