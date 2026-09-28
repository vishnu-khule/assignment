import type { ReferenceRates } from "@proposal/schemas";
import { ReferenceRatesSchema } from "@proposal/schemas";

const LABOR_BY_CURRENCY: Record<string, number> = {
  USD: 85,
  GBP: 68,
  EUR: 72,
  INR: 650,
};

const COST_SCALE: Record<string, number> = {
  USD: 1,
  GBP: 0.85,
  EUR: 0.9,
  INR: 42,
};

export function defaultReferenceRates(currency = "USD"): ReferenceRates {
  const scale = COST_SCALE[currency] ?? 1;
  const laborRate = LABOR_BY_CURRENCY[currency] ?? 85 * scale;
  const m = (n: number) => Math.round(n * scale * 100) / 100;

  return ReferenceRatesSchema.parse({
    currency,
    materials: [
      {
        sku: "PIPE-15",
        description: "15mm supply pipe",
        unit: "ea",
        unit_cost: m(25),
        material_tier: "tier_c",
      },
      {
        sku: "PIPE-15",
        description: "15mm supply pipe",
        unit: "ea",
        unit_cost: m(38),
        material_tier: "tier_b",
      },
      {
        sku: "PIPE-15",
        description: "15mm supply pipe",
        unit: "ea",
        unit_cost: m(55),
        material_tier: "tier_a",
      },
      {
        sku: "PANEL-200",
        description: "200A panel",
        unit: "ea",
        unit_cost: m(450),
        material_tier: "tier_b",
      },
      {
        sku: "LABOR-GENERAL",
        description: "General job materials bundle",
        unit: "job",
        unit_cost: m(150),
        material_tier: "tier_c",
      },
      {
        sku: "LABOR-GENERAL",
        description: "General job materials bundle",
        unit: "job",
        unit_cost: m(220),
        material_tier: "tier_b",
      },
      {
        sku: "LABOR-GENERAL",
        description: "General job materials bundle",
        unit: "job",
        unit_cost: m(320),
        material_tier: "tier_a",
      },
    ],
    labor: [
      { role: "journeyman", rate_per_hour: laborRate },
      { role: "apprentice", rate_per_hour: Math.round(laborRate * 0.65) },
    ],
    market_defaults: {
      default: m(75),
      materials: m(40),
      labor: laborRate,
      equipment: m(120),
    },
  });
}
