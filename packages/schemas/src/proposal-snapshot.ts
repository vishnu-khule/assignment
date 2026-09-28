import { z } from "zod";
import { TradeSchema } from "./session.js";
import { ScopePlanSchema } from "./scope.js";
import { TierPricingSchema } from "./pricing.js";
import { DocumentedAssumptionSchema } from "./clarification.js";
import { BillOfQuantitiesSchema } from "./boq.js";
import { ProposalDocumentSectionsSchema } from "./proposal-document.js";
import { ProposalQaResultSchema } from "./proposal-qa.js";
import { TierKeySchema } from "./tier.js";

export { TierKeySchema };

export const NarrativeSectionsSchema = z.object({
  summary: z.string(),
  scope: z.string(),
  materials_highlight: z.string(),
  timeline: z.string(),
  warranty: z.string(),
  next_steps: z.string(),
});

export type NarrativeSections = z.infer<typeof NarrativeSectionsSchema>;

export const TierBundleSchema = z.object({
  tier: TierKeySchema,
  scope: ScopePlanSchema,
  pricing: TierPricingSchema,
  narrative: NarrativeSectionsSchema,
  document_sections: ProposalDocumentSectionsSchema.optional(),
});

export const ProposalSnapshotSchema = z.object({
  snapshot_id: z.string().uuid(),
  session_id: z.string().uuid(),
  org_id: z.string(),
  version: z.number().int().positive(),
  content_hash: z.string(),
  created_at: z.string().datetime(),
  trade: TradeSchema,
  locale: z.string(),
  currency: z.string().length(3),
  customer: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
  site: z
    .object({
      address: z.string().optional(),
    })
    .optional(),
  assumptions: z.array(z.string()),
  documented_assumptions: z.array(DocumentedAssumptionSchema).optional(),
  bill_of_quantities: BillOfQuantitiesSchema.optional(),
  qa_verification: ProposalQaResultSchema.optional(),
  exclusions: z.array(z.string()),
  tiers: z.object({
    basic: TierBundleSchema,
    modern: TierBundleSchema,
    premium: TierBundleSchema,
  }),
  branding: z.object({
    company_name: z.string(),
    logo_url: z.string().url().optional(),
    license_number: z.string().optional(),
  }),
});

export type ProposalSnapshot = z.infer<typeof ProposalSnapshotSchema>;
