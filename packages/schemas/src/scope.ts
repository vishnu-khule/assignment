import { z } from "zod";

export const TierEligibilitySchema = z.object({
  basic: z.boolean(),
  modern: z.boolean(),
  premium: z.boolean(),
});

export const ScopeLineItemSchema = z.object({
  sku_or_code: z.string(),
  description: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  labor_hours: z.number().nonnegative(),
  material_spec: z.string().optional(),
  tier_eligibility: TierEligibilitySchema,
});

export const ScopePlanSchema = z.object({
  line_items: z.array(ScopeLineItemSchema),
  assumptions: z.array(z.string()),
  exclusions: z.array(z.string()),
  timeline_days: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }),
});

export type ScopeLineItem = z.infer<typeof ScopeLineItemSchema>;
export type ScopePlan = z.infer<typeof ScopePlanSchema>;
