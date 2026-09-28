import {
  ProposalDocumentSectionsSchema,
  type CompanyProfile,
  type ProposalDocumentSections,
  type TierKey,
  type TierPricing,
} from "@proposal/schemas";
import { completeChat, getOpenAI, primaryModel } from "./client.js";
import { formatPriceSummary } from "./price-summary.js";
import { buildProposalContextBullets } from "./proposal-writer-context.js";

export const PROPOSAL_WRITER_SYSTEM_PROMPT = `Write a customer-facing proposal for the {tier} option using {project_data},
{priced_items}, and {company_profile}. Sections: cover summary, understanding
of requirements, scope of work, materials and specifications, timeline,
price summary, payment terms, warranty, exclusions, assumptions, next steps.
Tier guidance:
- Basic: essential scope, standard materials, minimum warranty.
- Modern: improved materials, better finish, extended warranty.
- Premium: top-grade materials, extras, priority schedule, longest warranty.
Match tone of the user's past documents. Use only numbers provided. Return
JSON sections for template rendering.

Output JSON only with keys:
cover_summary, understanding_of_requirements, scope_of_work,
materials_and_specifications, timeline, price_summary, payment_terms,
warranty, exclusions, assumptions, next_steps

Rules:
- Do NOT invent dollar amounts, tax, or totals; copy price_summary exactly from priced_items.price_summary_text if provided.
- Use plain, professional language suitable for homeowners and small businesses.
- exclusions and assumptions may be bullet lists as a single string.
- Match tone_samples when provided.
- When qa_fixes is non-empty, address every listed fix from the verifier (Step 6 revision).`;

const TIER_GUIDANCE: Record<TierKey, string> = {
  basic: "Essential scope, standard materials, minimum warranty.",
  modern: "Improved materials, better finish, extended warranty.",
  premium: "Top-grade materials, extras, priority schedule, longest warranty.",
};

export interface WriteProposalInput {
  tier: TierKey;
  project_data: Record<string, unknown>;
  priced_items: TierPricing;
  currency: string;
  company_profile: CompanyProfile;
  exclusions: string[];
  assumptions: string[];
  warranty_months: number;
  timeline_text: string;
  tone_samples?: string[];
  qa_fixes?: string[];
}

function documentToNarrative(doc: ProposalDocumentSections) {
  return {
    summary: doc.cover_summary,
    scope: doc.scope_of_work,
    materials_highlight: doc.materials_and_specifications,
    timeline: doc.timeline,
    warranty: doc.warranty,
    next_steps: doc.next_steps,
  };
}

export function writeProposalHeuristic(
  input: WriteProposalInput,
): { document: ProposalDocumentSections; narrative: ReturnType<typeof documentToNarrative> } {
  const price_summary = formatPriceSummary(input.priced_items, input.currency);
  const customer =
    (input.project_data.customer as { name?: string })?.name ?? "Customer";
  const ctx = buildProposalContextBullets(input);

  const understandingParts = [
    `We understand you need: ${ctx.work}.`,
    ctx.site ? `Job site: ${ctx.site}.` : null,
    ctx.area ? `Approximate area: ${ctx.area}.` : null,
    ctx.timeline ? `Target completion: ${ctx.timeline}.` : null,
    `This ${input.tier} option — ${TIER_GUIDANCE[input.tier]}`,
  ].filter(Boolean);

  const scopeBody =
    ctx.scopeBullets.length > 0
      ? ctx.scopeBullets.map((b) => `• ${b}`).join("\n")
      : `• ${ctx.work}`;

  const document = ProposalDocumentSectionsSchema.parse({
    cover_summary: [
      `${input.company_profile.company_name}`,
      `${input.tier.charAt(0).toUpperCase() + input.tier.slice(1)} proposal for ${customer}`,
      ctx.site ? `Site: ${ctx.site}` : null,
      `Quote date: ${new Date().toISOString().slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    understanding_of_requirements: understandingParts.join("\n"),
    scope_of_work: scopeBody,
    materials_and_specifications: `${ctx.materialNote}\n${TIER_GUIDANCE[input.tier]}`,
    timeline: ctx.timeline ?? input.timeline_text,
    price_summary,
    payment_terms:
      input.company_profile.default_payment_terms ??
      "50% deposit upon acceptance; balance due on completion unless otherwise agreed.",
    warranty: `${input.warranty_months} months workmanship warranty on labor; manufacturer warranties on materials where applicable.`,
    exclusions: input.exclusions.map((e) => `• ${e}`).join("\n") || "• Permit fees unless stated\n• Unforeseen structural or hazardous material remediation",
    assumptions:
      input.assumptions.map((a) => `• ${a}`).join("\n") ||
      "• Final pricing confirmed after site verification.\n• Access and working hours as discussed.",
    next_steps:
      "1. Review this estimate and scope.\n2. Reply to accept or request revisions.\n3. Schedule site verification if required.\n4. Sign and pay deposit to hold the schedule.",
  });

  return { document, narrative: documentToNarrative(document) };
}

export async function writeProposalDocument(
  input: WriteProposalInput,
): Promise<{
  document: ProposalDocumentSections;
  narrative: ReturnType<typeof documentToNarrative>;
}> {
  const price_summary = formatPriceSummary(input.priced_items, input.currency);
  if (!getOpenAI()) {
    return writeProposalHeuristic({ ...input, priced_items: input.priced_items });
  }

  const text = await completeChat({
    model: primaryModel(),
    max_tokens: 4096,
    system: PROPOSAL_WRITER_SYSTEM_PROMPT,
    user: JSON.stringify({
      tier: input.tier,
      tier_guidance: TIER_GUIDANCE[input.tier],
      project_data: input.project_data,
      priced_items: {
        ...input.priced_items,
        price_summary_text: price_summary,
      },
      company_profile: input.company_profile,
      exclusions: input.exclusions,
      assumptions: input.assumptions,
      timeline_text: input.timeline_text,
      warranty_months: input.warranty_months,
      tone_samples: input.tone_samples ?? [],
      qa_fixes: input.qa_fixes ?? [],
    }),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return writeProposalHeuristic(input);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    parsed.price_summary = price_summary;
    const document = ProposalDocumentSectionsSchema.parse(parsed);
    return { document, narrative: documentToNarrative(document) };
  } catch {
    return writeProposalHeuristic(input);
  }
}

export { documentToNarrative };
