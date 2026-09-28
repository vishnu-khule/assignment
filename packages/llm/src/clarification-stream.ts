import type { GapReadinessResult } from "@proposal/schemas";
import { fastModel, getOpenAI, streamChat } from "./client.js";
import { formatClarificationHeuristic } from "./clarification.js";

const STREAM_SYSTEM = `You are a friendly assistant for a tradesperson. Ask exactly ONE short clarifying question.
Plain text only — no JSON, no bullet lists, max 2 sentences.`;

export async function streamClarificationMessage(
  gap: GapReadinessResult,
  onDelta: (text: string) => void,
): Promise<string> {
  if (gap.ready_to_generate || gap.missing.length === 0) {
    const msg = formatClarificationHeuristic(gap).message;
    onDelta(msg);
    return msg;
  }

  const next = gap.missing[0];
  if (!next) {
    const msg = formatClarificationHeuristic(gap).message;
    onDelta(msg);
    return msg;
  }

  if (!getOpenAI()) {
    onDelta(next.question);
    return next.question;
  }

  const streamed = await streamChat({
    model: fastModel(),
    max_tokens: 220,
    system: STREAM_SYSTEM,
    user: JSON.stringify({
      field: next.field,
      why_needed: next.why_needed,
      hint: next.question,
    }),
    onDelta,
  });
  if (!streamed.trim()) {
    onDelta(next.question);
    return next.question;
  }
  return streamed;
}
