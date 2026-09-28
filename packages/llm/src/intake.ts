import {
  AttachmentRefSchema,
  IntakeResultSchema,
  type IntakeResult,
} from "@proposal/schemas";
import { z } from "zod";
import { completeChat, fastModel, getOpenAI, primaryModel } from "./client.js";

export const INTAKE_SYSTEM_PROMPT = `You are an intake assistant for trade professionals. From the user message and
attachment list, identify: trade_type (plumbing, electrical, furniture, civil,
HVAC, other), job_type, location, language, currency, and customer info.
Return JSON only: {trade_type, job_type, language, currency, location, customer, summary,
detected_intent, confidence}.

Rules:
- trade_type must be exactly one of: plumbing, electrical, furniture, civil, HVAC, other.
- currency: ISO 4217 three-letter code; infer from location or message when possible.
- language: BCP-47 tag (e.g. en-US, en-GB, es-MX).
- location: object with optional address, city, region, country when known.
- customer: optional name, email, phone, company — do not invent contact details.
- summary: one or two sentences of the requested work.
- detected_intent: new_proposal | revise_estimate | clarification | upload_only | unknown.
- confidence: 0.0–1.0 for overall extraction quality.
- Use attachment filenames/MIME types as weak hints (e.g. "panel_schedule.pdf" → electrical).
- Never output prices or line-item quantities.`;

const IntakeInputSchema = z.object({
  user_message: z.string(),
  attachments: z.array(AttachmentRefSchema).default([]),
  reference_extractions: z.array(z.record(z.unknown())).optional(),
  default_currency: z.string().length(3).optional(),
  default_language: z.string().optional(),
});

export type IntakeInput = z.infer<typeof IntakeInputSchema>;

function heuristicIntake(input: IntakeInput): IntakeResult {
  const msg = input.user_message.toLowerCase();
  let trade_type: IntakeResult["trade_type"] = "other";
  if (msg.includes("plumb") || msg.includes("pipe") || msg.includes("drain")) {
    trade_type = "plumbing";
  } else if (msg.includes("electric") || msg.includes("panel") || msg.includes("wiring")) {
    trade_type = "electrical";
  } else if (msg.includes("hvac") || msg.includes("furnace") || msg.includes("ac unit")) {
    trade_type = "HVAC";
  } else if (msg.includes("furniture") || msg.includes("cabinet") || msg.includes("millwork")) {
    trade_type = "furniture";
  } else if (msg.includes("concrete") || msg.includes("civil") || msg.includes("foundation")) {
    trade_type = "civil";
  }

  for (const a of input.attachments) {
    const f = a.filename.toLowerCase();
    if (f.includes("plumb")) trade_type = "plumbing";
    if (f.includes("electric") || f.includes("panel")) trade_type = "electrical";
  }

  const intent =
    input.attachments.length > 0 && input.user_message.trim().length < 20
      ? "upload_only"
      : msg.includes("revise") || msg.includes("update quote")
        ? "revise_estimate"
        : "new_proposal";

  return IntakeResultSchema.parse({
    trade_type,
    job_type: undefined,
    language: input.default_language ?? "en-US",
    currency: input.default_currency ?? "USD",
    location: undefined,
    customer: {},
    summary:
      input.user_message.trim().slice(0, 280) ||
      (input.attachments.length
        ? `Review ${input.attachments.length} attachment(s) for scoping.`
        : "Trade job request"),
    detected_intent: intent,
    confidence: input.user_message.length > 30 ? 0.55 : 0.35,
  });
}

export async function runIntakeAssistant(
  input: IntakeInput,
): Promise<IntakeResult> {
  const parsed = IntakeInputSchema.parse(input);
  if (!getOpenAI()) {
    return heuristicIntake(parsed);
  }

  const hasDocContext =
    parsed.attachments.length > 0 ||
    (parsed.reference_extractions?.length ?? 0) > 0;
  const model = hasDocContext ? primaryModel() : fastModel();

  const text = await completeChat({
    model,
    max_tokens: 2048,
    system: INTAKE_SYSTEM_PROMPT,
    user: JSON.stringify({
      user_message: parsed.user_message,
      attachments: parsed.attachments,
      reference_extractions: parsed.reference_extractions ?? [],
      hints: {
        default_currency: parsed.default_currency,
        default_language: parsed.default_language,
      },
    }),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return heuristicIntake(parsed);
  }

  try {
    return IntakeResultSchema.parse(JSON.parse(jsonMatch[0]));
  } catch {
    return heuristicIntake(parsed);
  }
}
