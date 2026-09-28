import type { ReferenceDocumentExtraction, SessionContext } from "@proposal/schemas";

/** Flatten session + extractions into one object for gap analysis. */
export function buildGapAnalysisData(
  context: SessionContext,
  userMessage: string,
  attachmentExcerpts: string[],
): Record<string, unknown> {
  const extractions = Array.isArray(context.requirements.reference_extractions)
    ? (context.requirements.reference_extractions as ReferenceDocumentExtraction[])
    : [];

  const fromDocs = {
    line_items: extractions.flatMap((e) => e.line_items ?? []),
    scope_of_work: extractions.flatMap((e) => e.scope_of_work ?? []),
    dimensions: extractions.flatMap((e) => e.dimensions ?? []),
    warranty: extractions.map((e) => e.warranty).filter(Boolean),
  };

  const intake = context.requirements.intake as Record<string, unknown> | undefined;
  const location = intake?.location as Record<string, unknown> | undefined;

  return {
    user_message: userMessage,
    trade: context.trade,
    job_type: context.job_type,
    customer: context.customer,
    site: context.site,
    requirements: context.requirements,
    intake,
    location,
    work_summary:
      context.requirements.work_summary ??
      intake?.summary ??
      (userMessage.length > 20 ? userMessage : undefined),
    site_address:
      (context.requirements.site_address as string | undefined) ??
      context.site?.address ??
      location?.address,
    attachment_excerpts: attachmentExcerpts.slice(0, 8),
    extracted: fromDocs,
  };
}
