import {
  ProposalDocumentSectionsSchema,
  ProposalQaResultSchema,
  type ProposalDocumentSections,
  type ProposalQaResult,
  type TierKey,
  type TierPricing,
} from "@proposal/schemas";
import { formatPriceSummary } from "./price-summary.js";
import { completeChat, fastModel, getOpenAI } from "./client.js";

export const PROPOSAL_VERIFIER_SYSTEM_PROMPT = `Verify the proposal against the source data. Check: totals match the pricing
engine, no invented specs, all assumptions listed, consistent dates and
currency, no missing sections, professional tone. Return
{passed, issues:[{severity, location, fix}]}. If failed, send back to Step 6.

Step 6 is the proposal narrative writer — fixes should be actionable for re-writing customer-facing sections.

severity: "error" blocks release; "warning" is advisory.
Output JSON only.`;

const REQUIRED_SECTIONS = ProposalDocumentSectionsSchema.keyof().options;

const NARRATIVE_SECTIONS: (keyof ProposalDocumentSections)[] = [
  "cover_summary",
  "understanding_of_requirements",
  "scope_of_work",
  "materials_and_specifications",
  "timeline",
  "payment_terms",
  "warranty",
  "exclusions",
  "assumptions",
  "next_steps",
];

function extractMoneyTokens(text: string): string[] {
  return [
    ...text.matchAll(
      /(?:USD|EUR|GBP|CAD|AUD|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?|\b[\d,]+\.\d{2}\s*(?:USD|EUR|GBP)\b/gi,
    ),
  ].map((m) => m[0]);
}

export interface VerifyTierProposalInput {
  tier: TierKey;
  document: ProposalDocumentSections;
  pricing: TierPricing;
  currency: string;
  source_assumptions: string[];
  expected_price_summary: string;
}

export function verifyTierProposal(
  input: VerifyTierProposalInput,
): ProposalQaResult {
  const issues: ProposalQaResult["issues"] = [];
  const loc = (section: string) => `tiers.${input.tier}.document_sections.${section}`;

  for (const key of REQUIRED_SECTIONS) {
    const val = input.document[key]?.trim();
    if (!val) {
      issues.push({
        severity: "error",
        location: loc(key),
        fix: `Fill section "${key}" before release.`,
      });
    }
  }

  const expectedTotal = `${input.currency} ${input.pricing.total.toFixed(2)}`;
  if (!input.document.price_summary.includes(expectedTotal)) {
    issues.push({
      severity: "error",
      location: loc("price_summary"),
      fix: `Price summary must include exact total from pricing engine: ${expectedTotal}.`,
    });
  }

  if (!input.document.price_summary.includes(input.pricing.valid_until)) {
    issues.push({
      severity: "error",
      location: loc("price_summary"),
      fix: `Include quote validity date: ${input.pricing.valid_until}.`,
    });
  }

  const expectedBlock = input.expected_price_summary.trim();
  if (input.document.price_summary.trim() !== expectedBlock) {
    issues.push({
      severity: "warning",
      location: loc("price_summary"),
      fix: "Re-sync price_summary with pricing engine output (Step 6 rewrite).",
    });
  }

  if (input.currency === "USD" && /€|EUR\b/i.test(input.document.price_summary)) {
    issues.push({
      severity: "error",
      location: loc("price_summary"),
      fix: `Use consistent currency ${input.currency} only.`,
    });
  }
  if (input.currency === "EUR" && /\$|USD\b/i.test(input.document.price_summary)) {
    issues.push({
      severity: "error",
      location: loc("price_summary"),
      fix: `Use consistent currency ${input.currency} only.`,
    });
  }

  for (const section of NARRATIVE_SECTIONS) {
    const money = extractMoneyTokens(input.document[section]);
    if (money.length > 0) {
      issues.push({
        severity: "error",
        location: loc(section),
        fix: "Remove monetary amounts from narrative sections; keep all figures in price_summary only.",
      });
    }
  }

  for (const assumption of input.source_assumptions) {
    const snippet = assumption.slice(0, 40);
    if (
      snippet.length > 10 &&
      !input.document.assumptions.includes(snippet) &&
      !input.document.assumptions.toLowerCase().includes(assumption.toLowerCase().slice(0, 20))
    ) {
      issues.push({
        severity: "warning",
        location: loc("assumptions"),
        fix: `List assumption in document: "${assumption.slice(0, 80)}…"`,
      });
    }
  }

  const allText = Object.values(input.document).join(" ");
  if (/\b(fuck|shit|damn)\b/i.test(allText)) {
    issues.push({
      severity: "error",
      location: `tiers.${input.tier}`,
      fix: "Use professional tone; remove informal language.",
    });
  }
  if (allText.length > 50 && allText === allText.toUpperCase()) {
    issues.push({
      severity: "warning",
      location: `tiers.${input.tier}`,
      fix: "Avoid all-caps body text; use professional tone.",
    });
  }

  const hasError = issues.some((i) => i.severity === "error");
  return ProposalQaResultSchema.parse({
    passed: !hasError,
    issues,
  });
}

export interface VerifySnapshotInput {
  tiers: TierKey[];
  documents: Record<TierKey, ProposalDocumentSections>;
  pricing: Record<TierKey, TierPricing>;
  currency: string;
  source_assumptions: string[];
}

export function verifyProposalSnapshot(
  input: VerifySnapshotInput,
): ProposalQaResult {
  const allIssues: ProposalQaResult["issues"] = [];

  for (const tier of input.tiers) {
    const result = verifyTierProposal({
      tier,
      document: input.documents[tier],
      pricing: input.pricing[tier],
      currency: input.currency,
      source_assumptions: input.source_assumptions,
      expected_price_summary: formatPriceSummary(input.pricing[tier], input.currency),
    });
    allIssues.push(...result.issues);
  }

  const hasError = allIssues.some((i) => i.severity === "error");
  return ProposalQaResultSchema.parse({
    passed: !hasError,
    issues: allIssues,
  });
}

export async function verifyProposalWithLlm(
  deterministic: ProposalQaResult,
  context: {
    project_data: Record<string, unknown>;
    tier: TierKey;
    document: ProposalDocumentSections;
  },
): Promise<ProposalQaResult> {
  if (!getOpenAI()) return deterministic;

  const text = await completeChat({
    model: fastModel(),
    max_tokens: 1024,
    system: PROPOSAL_VERIFIER_SYSTEM_PROMPT,
    user: JSON.stringify({
      prior_issues: deterministic.issues,
      project_data: context.project_data,
      tier: context.tier,
      document: context.document,
    }),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return deterministic;

  try {
    const llm = ProposalQaResultSchema.parse(JSON.parse(jsonMatch[0]));
    const merged = [...deterministic.issues, ...llm.issues];
    const hasError = merged.some((i) => i.severity === "error");
    return ProposalQaResultSchema.parse({ passed: !hasError, issues: merged });
  } catch {
    return deterministic;
  }
}
