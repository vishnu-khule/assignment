import type { GapReadinessResult, SessionContext } from "@proposal/schemas";

export function gapReadinessToSessionPatch(
  context: SessionContext,
  result: GapReadinessResult,
  requirementsPatch: Record<string, unknown>,
): Partial<SessionContext> {
  const gaps = result.missing.map((m) => ({
    field_id: m.field,
    severity: "blocking" as const,
    question: m.question,
    suggested_default: undefined,
  }));

  const siteAddress =
    typeof requirementsPatch.site_address === "string"
      ? requirementsPatch.site_address.trim()
      : "";

  return {
    ...(siteAddress
      ? {
          site: {
            ...context.site,
            address: siteAddress,
          },
        }
      : {}),
    requirements: {
      ...context.requirements,
      ...requirementsPatch,
      gap_readiness: result,
    },
    gaps,
    readiness: {
      can_generate: result.ready_to_generate,
      blocking_missing: result.missing.map((m) => m.field),
    },
  };
}

export function assistantMessageFromGapReadiness(
  result: GapReadinessResult,
): string {
  if (result.ready_to_generate) {
    return "I have enough to generate Basic, Modern, and Premium options. Tap Generate when ready.";
  }
  const n = result.missing.length;
  const first = result.missing[0]?.question;
  return n === 1 && first
    ? `One quick question: ${first}`
    : `I need ${n} details before I can estimate accurately.`;
}
