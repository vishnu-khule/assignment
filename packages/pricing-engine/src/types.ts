import type { ScopeLineItem, TierKey } from "@proposal/schemas";

export interface MaterialCatalogEntry {
  sku: string;
  unit_cost: number;
  tier: "tier_a" | "tier_b" | "tier_c";
}

export interface RateCard {
  default_labor_rate: number;
  by_role?: Record<string, number>;
}

export interface TierRules {
  material_tier_map: Record<TierKey, "tier_a" | "tier_b" | "tier_c">;
  labor_multiplier: Record<TierKey, number>;
  margin_pct: Record<TierKey, number>;
  warranty_months: Record<TierKey, number>;
}

export interface OrgPricingSettings {
  currency: string;
  overhead_pct: number;
  material_markup_pct: number;
  default_margin_pct: number;
  tax_rate: number;
  quote_valid_days: number;
}

export interface PricingInput {
  tier: TierKey;
  line_items: ScopeLineItem[];
  catalog: MaterialCatalogEntry[];
  rate_card: RateCard;
  tier_rules: TierRules;
  settings: OrgPricingSettings;
}
