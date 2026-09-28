import type { TierPricing } from "./output.js";
import type { PricingInput } from "./types.js";
import type { ScopeLineItem, TierKey } from "@proposal/schemas";

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isEligible(item: ScopeLineItem, tier: TierKey): boolean {
  return item.tier_eligibility[tier];
}

function resolveUnitCost(
  sku: string,
  catalog: PricingInput["catalog"],
  materialTier: "tier_a" | "tier_b" | "tier_c",
): number {
  const match = catalog.find((c) => c.sku === sku && c.tier === materialTier);
  if (match) return match.unit_cost;
  const fallback = catalog.find((c) => c.sku === sku);
  return fallback?.unit_cost ?? 0;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeTierPricing(input: PricingInput): TierPricing {
  const {
    tier,
    line_items,
    catalog,
    rate_card,
    tier_rules,
    settings,
  } = input;

  const materialTier = tier_rules.material_tier_map[tier];
  const laborMult = tier_rules.labor_multiplier[tier];
  const margin =
    tier_rules.margin_pct[tier] ?? settings.default_margin_pct;

  const eligible = line_items.filter((li) => isEligible(li, tier));

  let subtotalMaterials = 0;
  let subtotalLabor = 0;
  const pricedLines: TierPricing["line_items"] = [];

  for (const li of eligible) {
    const unitCost =
      resolveUnitCost(li.sku_or_code, catalog, materialTier) *
      (1 + settings.material_markup_pct);
    const materialExtended = roundMoney(li.quantity * unitCost);
    const laborRate = rate_card.default_labor_rate * laborMult;
    const laborExtended = roundMoney(li.labor_hours * laborRate);

    subtotalMaterials += materialExtended;
    subtotalLabor += laborExtended;

    if (materialExtended > 0) {
      pricedLines.push({
        description: `${li.description} (materials)`,
        qty: li.quantity,
        unit: li.unit,
        unit_price: roundMoney(unitCost),
        extended: materialExtended,
      });
    }
    if (laborExtended > 0) {
      pricedLines.push({
        description: `${li.description} (labor)`,
        qty: li.labor_hours,
        unit: "hr",
        unit_price: roundMoney(laborRate),
        extended: laborExtended,
      });
    }
  }

  subtotalMaterials = roundMoney(subtotalMaterials);
  subtotalLabor = roundMoney(subtotalLabor);

  let subtotal = subtotalMaterials + subtotalLabor;
  subtotal = roundMoney(subtotal * (1 + settings.overhead_pct));
  subtotal = roundMoney(subtotal * (1 + margin));

  const tax = roundMoney(subtotal * settings.tax_rate);
  const total = roundMoney(subtotal + tax);

  return {
    subtotal_materials: subtotalMaterials,
    subtotal_labor: subtotalLabor,
    overhead_pct: settings.overhead_pct,
    margin_pct: margin,
    subtotal,
    tax,
    total,
    line_items: pricedLines,
    warranty_months: tier_rules.warranty_months[tier],
    valid_until: addDaysIso(settings.quote_valid_days),
  };
}

export function computeAllTiers(
  line_items: ScopeLineItem[],
  catalog: PricingInput["catalog"],
  rate_card: PricingInput["rate_card"],
  tier_rules: PricingInput["tier_rules"],
  settings: PricingInput["settings"],
): { currency: string; tiers: Record<TierKey, TierPricing> } {
  const tiers = (["basic", "modern", "premium"] as TierKey[]).reduce(
    (acc, tier) => {
      acc[tier] = computeTierPricing({
        tier,
        line_items,
        catalog,
        rate_card,
        tier_rules,
        settings,
      });
      return acc;
    },
    {} as Record<TierKey, TierPricing>,
  );

  return { currency: settings.currency, tiers };
}
