import { z } from "zod";

export const PricedLineItemSchema = z.object({
  description: z.string(),
  qty: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  extended: z.number(),
});

export const TierPricingSchema = z.object({
  subtotal_materials: z.number(),
  subtotal_labor: z.number(),
  overhead_pct: z.number(),
  margin_pct: z.number(),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  line_items: z.array(PricedLineItemSchema),
  warranty_months: z.number().int().nonnegative(),
  valid_until: z.string().date(),
});

export const PriceQuoteSchema = z.object({
  currency: z.string().length(3),
  tiers: z.object({
    basic: TierPricingSchema,
    modern: TierPricingSchema,
    premium: TierPricingSchema,
  }),
});

export type PricedLineItem = z.infer<typeof PricedLineItemSchema>;
export type TierPricing = z.infer<typeof TierPricingSchema>;
export type PriceQuote = z.infer<typeof PriceQuoteSchema>;
