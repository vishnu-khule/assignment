import type { IntakeResult } from "@proposal/schemas";
import type { SessionContext } from "@proposal/schemas";

const TRADE_MAP: Record<
  IntakeResult["trade_type"],
  SessionContext["trade"] | undefined
> = {
  plumbing: "plumbing",
  electrical: "electrical",
  HVAC: "hvac",
  furniture: "general",
  civil: "general",
  other: "general",
};

export function applyIntakeToContext(
  context: SessionContext,
  intake: IntakeResult,
): SessionContext {
  const trade = TRADE_MAP[intake.trade_type] ?? context.trade ?? "general";
  const site = {
    ...context.site,
    address: intake.location?.address ?? context.site?.address,
  };

  return {
    ...context,
    trade,
    job_type: intake.job_type ?? context.job_type,
    locale: intake.language || context.locale,
    currency: intake.currency || context.currency,
    site,
    customer: {
      name: intake.customer.name ?? context.customer.name,
      email: intake.customer.email ?? context.customer.email,
      phone: intake.customer.phone ?? context.customer.phone,
    },
    requirements: {
      ...context.requirements,
      work_summary: intake.summary,
      intake,
      detected_intent: intake.detected_intent,
      intake_confidence: intake.confidence,
      location: intake.location,
    },
  };
}
