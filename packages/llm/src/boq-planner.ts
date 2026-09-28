import { randomUUID } from "crypto";
import {
  BillOfQuantitiesSchema,
  type BillOfQuantities,
  type ReferenceDocumentExtraction,
  type ReferenceRates,
  type TierKey,
} from "@proposal/schemas";
import { completeChat, getOpenAI, primaryModel } from "./client.js";

export const BOQ_PLANNER_SYSTEM_PROMPT = `Build a structured bill of quantities for three tiers (basic, modern, premium)
from {project_data} and {reference_rates}. Output items with category,
description, qty, unit, unit_cost_source (reference|user|market_assumption),
and tier. Do NOT compute totals; the pricing engine will. Flag every assumed
value.

Output JSON only:
{
  "currency": "USD",
  "items": [{
    "item_id": string,
    "category": "labor"|"materials"|"equipment"|"permits"|"subcontract"|"other",
    "description": string,
    "qty": number,
    "unit": string,
    "unit_cost_source": "reference"|"user"|"market_assumption",
    "tier": "basic"|"modern"|"premium",
    "is_assumed": boolean,
    "assumption_note": string optional,
    "reference_sku": string optional,
    "labor_hours": number optional
  }],
  "flagged_assumptions": string[]
}

Rules:
- Produce separate line items per tier (same work may appear 3 times with different specs/qty).
- Basic = economy scope; Modern = standard; Premium = upgraded materials/scope.
- Use reference_sku from reference_rates when unit_cost_source is reference.
- Set is_assumed true and assumption_note when qty/spec is inferred or market_assumption.
- Never output prices, totals, tax, or margin.`;

const TIERS: TierKey[] = ["basic", "modern", "premium"];

export function buildBoqHeuristic(
  projectData: Record<string, unknown>,
  referenceRates: ReferenceRates,
): BillOfQuantities {
  const currency =
    (projectData.currency as string) ?? referenceRates.currency ?? "USD";
  const summary = String(
    projectData.requirements &&
      typeof projectData.requirements === "object" &&
      (projectData.requirements as Record<string, unknown>).work_summary
      ? (projectData.requirements as Record<string, unknown>).work_summary
      : "General trade work per project brief",
  );

  const flagged: string[] = [];
  const items: BillOfQuantities["items"] = [];

  const extractions = Array.isArray(projectData.reference_extractions)
    ? (projectData.reference_extractions as ReferenceDocumentExtraction[])
    : [];
  const docLines = extractions
    .flatMap((e) => e.line_items ?? [])
    .filter((l) => l.description?.trim())
    .slice(0, 24);

  const workSummary = String(
    (projectData.requirements as Record<string, unknown>)?.work_summary ?? summary,
  );
  if (docLines.length < 2 && workSummary.length > 40 && /addition|remodel|renov|sf\b|kitchen|deck/i.test(workSummary)) {
    flagged.push("BOQ derived from uploaded estimate scope summary");
    for (const tier of TIERS) {
      items.push({
        item_id: randomUUID(),
        category: "labor",
        description: `${workSummary.slice(0, 200)} (${tier} labor)`,
        qty: tier === "premium" ? 1.2 : tier === "modern" ? 1 : 0.85,
        unit: "job",
        unit_cost_source: "market_assumption",
        tier,
        is_assumed: true,
        assumption_note: "Scope from uploaded estimate; pricing from reference rates",
        reference_sku: "labor",
        labor_hours: tier === "premium" ? 120 : tier === "modern" ? 80 : 60,
      });
    }
    return BillOfQuantitiesSchema.parse({
      currency,
      items,
      flagged_assumptions: flagged,
    });
  }

  if (docLines.length >= 2) {
    flagged.push(
      `BOQ seeded from ${docLines.length} uploaded estimate line(s) across ${extractions.length} file(s)`,
    );
    const tierScale: Record<TierKey, number> = {
      basic: 0.85,
      modern: 1,
      premium: 1.25,
    };
    for (const tier of TIERS) {
      for (const line of docLines) {
        const baseQty = line.qty ?? 1;
        items.push({
          item_id: randomUUID(),
          category: "materials",
          description: `${line.description.trim()} (${tier})`,
          qty: Math.round(baseQty * tierScale[tier] * 100) / 100,
          unit: line.unit?.trim() || "ea",
          unit_cost_source: line.unit_price != null ? "user" : "market_assumption",
          tier,
          is_assumed: line.unit_price == null,
          assumption_note:
            line.unit_price == null
              ? "Qty/unit from upload; price from reference rates"
              : undefined,
          reference_sku: "LABOR-GENERAL",
        });
      }
    }
    return BillOfQuantitiesSchema.parse({
      currency,
      items,
      flagged_assumptions: flagged,
    });
  }

  for (const tier of TIERS) {
    const sku = "LABOR-GENERAL";
    const qty = tier === "premium" ? 1.2 : tier === "modern" ? 1 : 0.9;
    const isAssumed = !(
      projectData.requirements as Record<string, unknown>
    )?.work_summary;
    if (isAssumed) {
      flagged.push(`BOQ qty for ${tier} tier derived from default template`);
    }

    items.push({
      item_id: randomUUID(),
      category: "materials",
      description: `${summary} (${tier} materials package)`,
      qty: Math.round(qty * 10) / 10,
      unit: "job",
      unit_cost_source: "reference",
      tier,
      is_assumed: isAssumed,
      assumption_note: isAssumed ? "Scope summarized from limited project data" : undefined,
      reference_sku: sku,
    });

    items.push({
      item_id: randomUUID(),
      category: "labor",
      description: `${summary} (${tier} labor)`,
      qty: tier === "premium" ? 10 : tier === "modern" ? 8 : 6,
      unit: "hr",
      unit_cost_source: "reference",
      tier,
      is_assumed: isAssumed,
      assumption_note: isAssumed ? "Labor hours estimated" : undefined,
      reference_sku: "labor",
      labor_hours: tier === "premium" ? 10 : tier === "modern" ? 8 : 6,
    });
  }

  return BillOfQuantitiesSchema.parse({
    currency,
    items,
    flagged_assumptions: flagged,
  });
}

export async function buildBillOfQuantities(
  projectData: Record<string, unknown>,
  referenceRates: ReferenceRates,
): Promise<BillOfQuantities> {
  if (!getOpenAI()) {
    return buildBoqHeuristic(projectData, referenceRates);
  }

  const text = await completeChat({
    model: primaryModel(),
    max_tokens: 8192,
    system: BOQ_PLANNER_SYSTEM_PROMPT,
    user: JSON.stringify({
      project_data: projectData,
      reference_rates: referenceRates,
    }),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return buildBoqHeuristic(projectData, referenceRates);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    for (const item of parsed.items ?? []) {
      if (!item.item_id) item.item_id = randomUUID();
    }
    parsed.currency = parsed.currency ?? referenceRates.currency;
    return BillOfQuantitiesSchema.parse(parsed);
  } catch {
    return buildBoqHeuristic(projectData, referenceRates);
  }
}
