import type { ReferenceDocumentExtraction, SessionContext } from "@proposal/schemas";

export function buildProjectData(
  context: SessionContext,
  ragSnippets: string[],
): Record<string, unknown> {
  const extractions = Array.isArray(context.requirements.reference_extractions)
    ? (context.requirements.reference_extractions as ReferenceDocumentExtraction[])
    : [];

  return {
    session_id: context.session_id,
    trade: context.trade,
    job_type: context.job_type,
    currency: context.currency,
    locale: context.locale,
    customer: context.customer,
    site: context.site,
    requirements: context.requirements,
    documented_assumptions: context.requirements.documented_assumptions,
    reference_extractions: extractions,
    rag_snippets: ragSnippets.slice(0, 12),
  };
}
