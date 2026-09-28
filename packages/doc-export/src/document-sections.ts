import type { ProposalDocumentSections, ProposalSnapshot, TierKey } from "@proposal/schemas";

const SECTION_ORDER: { key: keyof ProposalDocumentSections; title: string }[] = [
  { key: "cover_summary", title: "Summary" },
  { key: "understanding_of_requirements", title: "Understanding your requirements" },
  { key: "scope_of_work", title: "Scope of work" },
  { key: "materials_and_specifications", title: "Materials & specifications" },
  { key: "timeline", title: "Timeline" },
  { key: "price_summary", title: "Price summary" },
  { key: "payment_terms", title: "Payment terms" },
  { key: "warranty", title: "Warranty" },
  { key: "exclusions", title: "Exclusions" },
  { key: "assumptions", title: "Assumptions" },
  { key: "next_steps", title: "Next steps" },
];

export function getDocumentSections(
  snapshot: ProposalSnapshot,
  tier: TierKey,
): ProposalDocumentSections | null {
  return snapshot.tiers[tier].document_sections ?? null;
}

export function documentSectionsHtml(
  sections: ProposalDocumentSections,
): string {
  return SECTION_ORDER.map(({ key, title }) => {
    const body = sections[key].replace(/\n/g, "<br/>");
    return `<h2>${title}</h2><p>${body}</p>`;
  }).join("\n");
}

export function documentSectionsPlainBlocks(
  sections: ProposalDocumentSections,
): { title: string; body: string }[] {
  return SECTION_ORDER
    .map(({ key, title }) => ({
      title,
      body: sections[key]?.trim() ?? "",
    }))
    .filter((block) => block.body.length > 0);
}
