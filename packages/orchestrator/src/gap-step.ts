import type { GapReadinessResult, SessionContext } from "@proposal/schemas";
import { getTradeChecklist, type TradeKey } from "@proposal/schemas";
import {
  analyzeGapReadiness,
  buildGapAnalysisData,
  formatClarification,
  formatClarificationHeuristic,
  gapReadinessToSessionPatch,
  streamClarificationMessage,
} from "@proposal/llm";
import type { ClarificationTurn } from "@proposal/schemas";

function inferTrade(message: string): NonNullable<SessionContext["trade"]> {
  const m = message.toLowerCase();
  if (m.includes("plumb") || m.includes("pipe")) return "plumbing";
  if (m.includes("electric") || m.includes("panel")) return "electrical";
  if (m.includes("hvac") || m.includes("furnace")) return "hvac";
  return "general";
}

export async function runGapAnalysisStep(
  context: SessionContext,
  userMessage: string,
  attachmentExcerpts: string[] = [],
  requirementsSeed?: Record<string, unknown>,
  options?: { onAssistantDelta?: (delta: string) => void },
): Promise<{
  context: Partial<SessionContext>;
  assistant_message: string;
  questions: { field_id: string; question: string }[];
  gap_readiness: GapReadinessResult;
  full_gap_readiness: GapReadinessResult;
  clarification: ClarificationTurn;
}> {
  const trade: NonNullable<SessionContext["trade"]> =
    context.trade ?? inferTrade(userMessage);
  const checklist = getTradeChecklist(trade as TradeKey);

  const mergedRequirements = {
    ...context.requirements,
    ...requirementsSeed,
  };
  const data = buildGapAnalysisData(
    { ...context, requirements: mergedRequirements },
    userMessage,
    attachmentExcerpts,
  );

  const extractions = Array.isArray(context.requirements?.reference_extractions)
    ? context.requirements.reference_extractions
    : [];
  const extracted = data.extracted as { line_items?: unknown[] } | undefined;
  const useDeepAnalysis =
    attachmentExcerpts.length > 0 ||
    extractions.length > 0 ||
    (extracted?.line_items?.length ?? 0) > 0;

  const gapReadiness = await analyzeGapReadiness(
    checklist,
    data,
    useDeepAnalysis,
  );

  const activeGap = {
    ...gapReadiness,
    missing: gapReadiness.missing.slice(0, 1),
    ready_to_generate: gapReadiness.missing.length === 0,
  };

  const patch = gapReadinessToSessionPatch(
    { ...context, trade, requirements: mergedRequirements },
    gapReadiness,
    mergedRequirements,
  );

  const clarification = options?.onAssistantDelta
    ? formatClarificationHeuristic(activeGap)
    : await formatClarification(activeGap);
  let assistant_message = clarification.message;
  if (options?.onAssistantDelta) {
    assistant_message = await streamClarificationMessage(
      activeGap,
      options.onAssistantDelta,
    );
  }

  const uploadPreamble =
    extractions.length > 0
      ? `I've reviewed your ${extractions.length} uploaded file(s). `
      : attachmentExcerpts.length > 0
        ? "I've read your attachments. "
        : "";
  if (uploadPreamble && !assistant_message.startsWith("I've")) {
    assistant_message = uploadPreamble + assistant_message;
  }
  if (gapReadiness.missing.length > 1) {
    const also = gapReadiness.missing
      .slice(1, 4)
      .map((m) => `• ${m.question}`)
      .join("\n");
    assistant_message += `\n\nAfter that, I'll still need:\n${also}`;
  }

  const questions = gapReadiness.missing.slice(0, 4).map((m) => ({
    field_id: m.field,
    question: m.question,
  }));

  return {
    context: { trade, ...patch },
    assistant_message,
    questions,
    gap_readiness: activeGap,
    full_gap_readiness: gapReadiness,
    clarification,
  };
}
