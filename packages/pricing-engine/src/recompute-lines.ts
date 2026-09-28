import type { PricedLineItem, TierPricing } from "@proposal/schemas";

/** Re-sum totals after user edits priced line items (code-owned math). */
export function recomputeTierPricingFromLineItems(
  base: TierPricing,
  line_items: PricedLineItem[],
): TierPricing {
  const normalized = line_items.map((li) => ({
    ...li,
    extended: Number((li.qty * li.unit_price).toFixed(2)),
  }));
  const subtotal = normalized.reduce((s, li) => s + li.extended, 0);
  const taxRate =
    base.subtotal > 0 ? base.tax / base.subtotal : 0;
  const tax = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  const matRatio =
    base.subtotal > 0 ? base.subtotal_materials / base.subtotal : 0.5;

  return {
    ...base,
    line_items: normalized,
    subtotal: Number(subtotal.toFixed(2)),
    subtotal_materials: Number((subtotal * matRatio).toFixed(2)),
    subtotal_labor: Number((subtotal * (1 - matRatio)).toFixed(2)),
    tax,
    total,
  };
}
