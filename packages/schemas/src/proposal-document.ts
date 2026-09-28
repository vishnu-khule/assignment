import { z } from "zod";

/** Customer-facing proposal sections for template rendering. */
export const ProposalDocumentSectionsSchema = z.object({
  cover_summary: z.string(),
  understanding_of_requirements: z.string(),
  scope_of_work: z.string(),
  materials_and_specifications: z.string(),
  timeline: z.string(),
  price_summary: z.string(),
  payment_terms: z.string(),
  warranty: z.string(),
  exclusions: z.string(),
  assumptions: z.string(),
  next_steps: z.string(),
});

export type ProposalDocumentSections = z.infer<
  typeof ProposalDocumentSectionsSchema
>;

export const CompanyProfileSchema = z.object({
  company_name: z.string(),
  logo_url: z.string().url().optional(),
  license_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  default_payment_terms: z.string().optional(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
