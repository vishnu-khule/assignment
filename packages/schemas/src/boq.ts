import { z } from "zod";
import { TierKeySchema } from "./tier.js";

export const UnitCostSourceSchema = z.enum([
  "reference",
  "user",
  "market_assumption",
]);

export const BoqCategorySchema = z.enum([
  "labor",
  "materials",
  "equipment",
  "permits",
  "subcontract",
  "other",
]);

export const BoqLineItemSchema = z.object({
  item_id: z.string(),
  category: BoqCategorySchema,
  description: z.string(),
  qty: z.number().nonnegative(),
  unit: z.string(),
  unit_cost_source: UnitCostSourceSchema,
  tier: TierKeySchema,
  is_assumed: z.boolean(),
  assumption_note: z.string().optional(),
  reference_sku: z.string().optional(),
  labor_hours: z.number().nonnegative().optional(),
});

export const BillOfQuantitiesSchema = z.object({
  currency: z.string().length(3),
  items: z.array(BoqLineItemSchema),
  flagged_assumptions: z.array(z.string()),
});

export type BoqLineItem = z.infer<typeof BoqLineItemSchema>;
export type BillOfQuantities = z.infer<typeof BillOfQuantitiesSchema>;
