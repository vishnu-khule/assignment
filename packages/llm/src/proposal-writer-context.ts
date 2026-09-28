import type { ReferenceDocumentExtraction, TierKey, TierPricing } from "@proposal/schemas";
import type { CompanyProfile } from "@proposal/schemas";

export type ProposalWriterContextInput = {
  tier: TierKey;
  project_data: Record<string, unknown>;
  priced_items: TierPricing;
  timeline_text: string;
  company_profile: CompanyProfile;
};

export function buildProposalContextBullets(input: ProposalWriterContextInput): {
  work: string;
  site: string | null;
  area: string | null;
  timeline: string | null;
  scopeBullets: string[];
  materialNote: string;
} {
  const req =
    (input.project_data.requirements as Record<string, unknown>) ?? {};
  const site =
    (input.project_data.site as { address?: string })?.address ??
    (typeof req.site_address === "string" ? req.site_address : null);

  const work = String(
    req.work_summary ??
      req.last_user_message ??
      "the requested construction work",
  ).trim();

  const area =
    typeof req.area_dimensions === "string"
      ? req.area_dimensions
      : req.area_sqft != null
        ? `${req.area_sqft} sq ft`
        : req.area_sqm != null
          ? `${req.area_sqm} sq m`
          : null;

  const timeline =
    typeof req.deadline === "string"
      ? req.deadline
      : typeof req.timeline === "string"
        ? req.timeline
        : input.timeline_text;

  const extractions = Array.isArray(req.reference_extractions)
    ? (req.reference_extractions as ReferenceDocumentExtraction[])
    : [];

  const scopeBullets: string[] = [];
  if (work.length > 10) scopeBullets.push(work);
  for (const ext of extractions) {
    const scopeLine = ext.scope_of_work?.[0]?.text?.match(
      /\bScope:\s*,?\s*"?([^"\n]+)"?/i,
    )?.[1];
    if (scopeLine?.trim()) scopeBullets.push(scopeLine.trim());
    for (const li of (ext.line_items ?? []).slice(0, 12)) {
      if (li.description?.trim()) {
        const qty =
          li.qty != null ? ` (${li.qty}${li.unit ? ` ${li.unit}` : ""})` : "";
        scopeBullets.push(`${li.description.trim()}${qty}`);
      }
    }
  }
  const unique = [...new Set(scopeBullets)].slice(0, 18);

  const grade = String(req.material_grade ?? input.tier);
  const materialNote = `Material level: ${grade}. ${input.tier} tier specification applies.`;

  return { work, site, area, timeline, scopeBullets: unique, materialNote };
}
