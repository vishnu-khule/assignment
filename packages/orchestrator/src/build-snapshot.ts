import { createHash, randomUUID } from "crypto";
import {
  boqToScopeLineItems,
  computeAllTiers,
  computeAllTiersFromBoq,
} from "@proposal/pricing-engine";
import {
  buildProjectData,
  extractToneSamples,
  verifyProposalSnapshot,
} from "@proposal/llm";
import { buildTierWithQa } from "./build-tier-with-qa.js";
import type {
  BillOfQuantities,
  CompanyProfile,
  ProposalSnapshot,
  ReferenceRates,
  ScopeLineItem,
  ScopePlan,
  SessionContext,
  TierKey,
} from "@proposal/schemas";
import {
  DocumentedAssumptionSchema,
  ProposalSnapshotSchema,
  ScopePlanSchema,
} from "@proposal/schemas";
import { defaultReferenceRates } from "./default-reference-rates.js";

const TIERS: TierKey[] = ["basic", "modern", "premium"];

const DEFAULT_SCOPE_LINE: ScopeLineItem = {
  sku_or_code: "LABOR-GENERAL",
  description: "Labor and materials per scope",
  quantity: 1,
  unit: "job",
  labor_hours: 8,
  tier_eligibility: { basic: true, modern: true, premium: true },
};

function defaultScope(): ScopePlan {
  return ScopePlanSchema.parse({
    line_items: [DEFAULT_SCOPE_LINE],
    assumptions: ["Indicative quote; final price after site verification."],
    exclusions: ["Permit fees unless stated", "Unforeseen structural repairs"],
    timeline_days: { min: 1, max: 5 },
  });
}

const TIER_RULES = {
  material_tier_map: {
    basic: "tier_c" as const,
    modern: "tier_b" as const,
    premium: "tier_a" as const,
  },
  labor_multiplier: { basic: 1, modern: 1.05, premium: 1.2 },
  margin_pct: { basic: 0.12, modern: 0.18, premium: 0.22 },
  warranty_months: { basic: 12, modern: 24, premium: 60 },
};

export async function buildProposalSnapshot(
  context: SessionContext,
  orgBranding: { company_name: string; logo_url?: string },
  scopePlan?: ScopePlan,
  boq?: BillOfQuantities,
  referenceRates?: ReferenceRates,
  ragSnippets: string[] = [],
): Promise<ProposalSnapshot> {
  const rates = referenceRates ?? defaultReferenceRates(context.currency);
  const scopeFromBoq = boq
    ? ScopePlanSchema.parse({
        line_items: boqToScopeLineItems(boq),
        assumptions: [
          ...boq.flagged_assumptions,
          "Indicative quote; final price after site verification.",
        ],
        exclusions: ["Permit fees unless stated", "Unforeseen structural repairs"],
        timeline_days: { min: 1, max: 5 },
      })
    : null;

  const scope = scopeFromBoq ?? scopePlan ?? defaultScope();

  const taxRate =
    context.currency === "GBP" || context.currency === "EUR"
      ? 0.2
      : context.currency === "INR"
        ? 0.18
        : 0.08;

  const settings = {
    currency: context.currency,
    overhead_pct: 0.1,
    material_markup_pct: 0.15,
    default_margin_pct: 0.15,
    tax_rate: taxRate,
    quote_valid_days: 30,
  };

  const priceQuote = boq
    ? computeAllTiersFromBoq(
        boq,
        rates,
        TIER_RULES,
        settings,
        rates.labor[0]?.rate_per_hour ?? 85,
      )
    : computeAllTiers(
        scope.line_items,
        [
          { sku: "LABOR-GENERAL", unit_cost: 150, tier: "tier_c" },
          { sku: "LABOR-GENERAL", unit_cost: 220, tier: "tier_b" },
          { sku: "LABOR-GENERAL", unit_cost: 320, tier: "tier_a" },
        ],
        { default_labor_rate: rates.labor[0]?.rate_per_hour ?? 85 },
        TIER_RULES,
        settings,
      );

  const documentedRaw = context.requirements?.documented_assumptions;
  const documentedParsed = DocumentedAssumptionSchema.array().safeParse(
    documentedRaw,
  );
  const documented_assumptions = documentedParsed.success
    ? documentedParsed.data
    : undefined;
  const assumptionLines = [
    ...scope.assumptions,
    ...(documented_assumptions?.map(
      (a) => `${a.field}: ${a.assumed_value} — ${a.reason}`,
    ) ?? []),
    ...(boq?.flagged_assumptions ?? []),
  ];

  const projectData = buildProjectData(context, ragSnippets);
  const companyProfile: CompanyProfile = {
    company_name: orgBranding.company_name,
    logo_url: orgBranding.logo_url,
    default_payment_terms:
      (context.requirements.default_payment_terms as string) ??
      "50% deposit on acceptance; balance on completion.",
  };
  const toneSamples = extractToneSamples(context);
  const timelineText = `${scope.timeline_days.min}–${scope.timeline_days.max} business days`;

  const tierBundles = await Promise.all(
    TIERS.map(async (tier) => {
      const { document, narrative } = await buildTierWithQa({
        tier,
        project_data: projectData,
        priced_items: priceQuote.tiers[tier],
        currency: context.currency,
        company_profile: companyProfile,
        exclusions: scope.exclusions,
        assumptions: assumptionLines,
        warranty_months: priceQuote.tiers[tier].warranty_months,
        timeline_text: timelineText,
        tone_samples: toneSamples,
      });
      return {
        tier,
        scope,
        pricing: priceQuote.tiers[tier],
        narrative,
        document_sections: document,
      };
    }),
  );

  const qa_verification = verifyProposalSnapshot({
    tiers: TIERS,
    documents: {
      basic: tierBundles[0].document_sections,
      modern: tierBundles[1].document_sections,
      premium: tierBundles[2].document_sections,
    },
    pricing: {
      basic: priceQuote.tiers.basic,
      modern: priceQuote.tiers.modern,
      premium: priceQuote.tiers.premium,
    },
    currency: context.currency,
    source_assumptions: assumptionLines,
  });

  const snapshot: ProposalSnapshot = {
    snapshot_id: randomUUID(),
    session_id: context.session_id,
    org_id: context.org_id,
    version: 1,
    content_hash: "",
    created_at: new Date().toISOString(),
    trade: context.trade ?? "general",
    locale: context.locale,
    currency: context.currency,
    customer: context.customer,
    site: context.site?.address
      ? context.site
      : typeof context.requirements?.site_address === "string"
        ? { address: context.requirements.site_address }
        : context.site,
    assumptions: assumptionLines,
    documented_assumptions,
    bill_of_quantities: boq,
    qa_verification,
    exclusions: scope.exclusions,
    tiers: {
      basic: tierBundles[0],
      modern: tierBundles[1],
      premium: tierBundles[2],
    },
    branding: {
      company_name: orgBranding.company_name,
      logo_url: orgBranding.logo_url,
    },
  };

  snapshot.content_hash = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");

  return ProposalSnapshotSchema.parse(snapshot);
}
