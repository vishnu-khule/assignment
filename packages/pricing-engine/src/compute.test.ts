import { describe, it } from "node:test";
import assert from "node:assert";
import { computeTierPricing } from "./compute.js";
import type { ScopeLineItem } from "@proposal/schemas";

const line: ScopeLineItem = {
  sku_or_code: "PIPE-15",
  description: "Replace supply line",
  quantity: 2,
  unit: "ea",
  labor_hours: 3,
  tier_eligibility: { basic: true, modern: true, premium: true },
};

describe("computeTierPricing", () => {
  it("returns deterministic totals", () => {
    const result = computeTierPricing({
      tier: "basic",
      line_items: [line],
      catalog: [{ sku: "PIPE-15", unit_cost: 25, tier: "tier_c" }],
      rate_card: { default_labor_rate: 80 },
      tier_rules: {
        material_tier_map: {
          basic: "tier_c",
          modern: "tier_b",
          premium: "tier_a",
        },
        labor_multiplier: { basic: 1, modern: 1.05, premium: 1.2 },
        margin_pct: { basic: 0.1, modern: 0.15, premium: 0.2 },
        warranty_months: { basic: 12, modern: 24, premium: 60 },
      },
      settings: {
        currency: "USD",
        overhead_pct: 0.1,
        material_markup_pct: 0.15,
        default_margin_pct: 0.1,
        tax_rate: 0.08,
        quote_valid_days: 30,
      },
    });

    assert.ok(result.total > 0);
    assert.equal(result.line_items.length, 2);
    assert.equal(
      result.subtotal + result.tax,
      Math.round((result.total + Number.EPSILON) * 100) / 100,
    );
  });
});
