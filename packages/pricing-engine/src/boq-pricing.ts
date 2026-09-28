import type {
  BillOfQuantities,
  BoqLineItem,
  ReferenceRates,
  TierKey,
} from "@proposal/schemas";
import type { TierPricing } from "./output.js";
import type { OrgPricingSettings, TierRules } from "./types.js";
import type { ScopeLineItem } from "@proposal/schemas";

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function resolveUnitCost(
  item: BoqLineItem,
  rates: ReferenceRates,
  materialTier: "tier_a" | "tier_b" | "tier_c",
): number {
  if (item.unit_cost_source === "user" && item.reference_sku) {
    const m = rates.materials.find((x) => x.sku === item.reference_sku);
    if (m) return m.unit_cost;
  }
  if (item.unit_cost_source === "reference" && item.reference_sku) {
    const m = rates.materials.find(
      (x) => x.sku === item.reference_sku && (!x.material_tier || x.material_tier === materialTier),
    );
    if (m) return m.unit_cost;
    const fallback = rates.materials.find((x) => x.sku === item.reference_sku);
    if (fallback) return fallback.unit_cost;
  }
  if (item.unit_cost_source === "market_assumption") {
    const key = item.reference_sku ?? item.category;
    return rates.market_defaults?.[key] ?? rates.market_defaults?.default ?? 0;
  }
  return 0;
}

function boqItemsToPricedLines(
  items: BoqLineItem[],
  tier: TierKey,
  rates: ReferenceRates,
  materialTier: "tier_a" | "tier_b" | "tier_c",
  laborRate: number,
  laborMult: number,
): TierPricing["line_items"] {
  const tierItems = items.filter((i) => i.tier === tier);
  const lines: TierPricing["line_items"] = [];

  for (const item of tierItems) {
    const assumedTag = item.is_assumed ? " [assumed]" : "";
    if (item.category === "labor") {
      const hours = item.labor_hours ?? item.qty;
      const rate = roundMoney(laborRate * laborMult);
      const extended = roundMoney(hours * rate);
      lines.push({
        description: `${item.description}${assumedTag}`,
        qty: hours,
        unit: "hr",
        unit_price: rate,
        extended,
      });
      continue;
    }

    const unitCost = resolveUnitCost(item, rates, materialTier);
    const unitPrice = roundMoney(unitCost);
    const extended = roundMoney(item.qty * unitPrice);
    lines.push({
      description: `${item.description}${assumedTag}`,
      qty: item.qty,
      unit: item.unit,
      unit_price: unitPrice,
      extended,
    });
  }

  return lines;
}

export function computeTierPricingFromBoq(
  tier: TierKey,
  boq: BillOfQuantities,
  rates: ReferenceRates,
  tierRules: TierRules,
  settings: OrgPricingSettings,
  defaultLaborRate: number,
): TierPricing {
  const materialTier = tierRules.material_tier_map[tier];
  const laborMult = tierRules.labor_multiplier[tier];
  const margin = tierRules.margin_pct[tier] ?? settings.default_margin_pct;

  const lineItems = boqItemsToPricedLines(
    boq.items,
    tier,
    rates,
    materialTier,
    defaultLaborRate,
    laborMult,
  );

  let subtotalMaterials = 0;
  let subtotalLabor = 0;
  for (const li of lineItems) {
    if (li.unit === "hr") subtotalLabor += li.extended;
    else subtotalMaterials += li.extended;
  }

  subtotalMaterials = roundMoney(subtotalMaterials);
  subtotalLabor = roundMoney(subtotalLabor);

  let subtotal = subtotalMaterials + subtotalLabor;
  subtotal = roundMoney(subtotal * (1 + settings.overhead_pct));
  subtotal = roundMoney(subtotal * (1 + margin));

  const tax = roundMoney(subtotal * settings.tax_rate);
  const total = roundMoney(subtotal + tax);

  const d = new Date();
  d.setUTCDate(d.getUTCDate() + settings.quote_valid_days);

  return {
    subtotal_materials: subtotalMaterials,
    subtotal_labor: subtotalLabor,
    overhead_pct: settings.overhead_pct,
    margin_pct: margin,
    subtotal,
    tax,
    total,
    line_items: lineItems,
    warranty_months: tierRules.warranty_months[tier],
    valid_until: d.toISOString().slice(0, 10),
  };
}

export function computeAllTiersFromBoq(
  boq: BillOfQuantities,
  rates: ReferenceRates,
  tierRules: TierRules,
  settings: OrgPricingSettings,
  defaultLaborRate: number,
): { currency: string; tiers: Record<TierKey, TierPricing> } {
  const tiers = (["basic", "modern", "premium"] as TierKey[]).reduce(
    (acc, tier) => {
      acc[tier] = computeTierPricingFromBoq(
        tier,
        boq,
        rates,
        tierRules,
        settings,
        defaultLaborRate,
      );
      return acc;
    },
    {} as Record<TierKey, TierPricing>,
  );
  return { currency: settings.currency, tiers };
}

/** Map BOQ into scope line items for legacy snapshot scope blocks. */
export function boqToScopeLineItems(boq: BillOfQuantities): ScopeLineItem[] {
  const seen = new Set<string>();
  const lines: ScopeLineItem[] = [];
  for (const item of boq.items) {
    const key = `${item.description}-${item.unit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      sku_or_code: item.reference_sku ?? "CUSTOM",
      description: item.description,
      quantity: item.qty,
      unit: item.unit,
      labor_hours: item.labor_hours ?? (item.category === "labor" ? item.qty : 0),
      tier_eligibility: {
        basic: boq.items.some((i) => i.description === item.description && i.tier === "basic"),
        modern: boq.items.some((i) => i.description === item.description && i.tier === "modern"),
        premium: boq.items.some((i) => i.description === item.description && i.tier === "premium"),
      },
    });
  }
  return lines;
}
