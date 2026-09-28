import { z } from "zod";

export const ReferenceMaterialRateSchema = z.object({
  sku: z.string(),
  description: z.string(),
  unit: z.string(),
  unit_cost: z.number().nonnegative(),
  material_tier: z.enum(["tier_a", "tier_b", "tier_c"]).optional(),
});

export const ReferenceLaborRateSchema = z.object({
  role: z.string(),
  rate_per_hour: z.number().nonnegative(),
});

export const ReferenceRatesSchema = z.object({
  currency: z.string().length(3),
  materials: z.array(ReferenceMaterialRateSchema),
  labor: z.array(ReferenceLaborRateSchema),
  market_defaults: z.record(z.number().nonnegative()).optional(),
});

export type ReferenceRates = z.infer<typeof ReferenceRatesSchema>;
