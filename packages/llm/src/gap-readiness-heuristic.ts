import {
  GapReadinessResultSchema,
  type GapReadinessResult,
  type TradeChecklistField,
} from "@proposal/schemas";

function getFieldValue(data: Record<string, unknown>, field: string): unknown {
  const req = data.requirements as Record<string, unknown> | undefined;
  if (req?.[field] != null && req[field] !== "") return req[field];

  switch (field) {
    case "work_summary":
      return data.work_summary;
    case "site_address":
      return (
        req?.site_address ??
        data.site_address ??
        (data.site as { address?: string })?.address
      );
    case "area_sqm":
      if (req?.area_sqm != null && req.area_sqm !== "") return req.area_sqm;
      if (req?.area_sqft != null && req.area_sqft !== "") return req.area_sqft;
      if (req?.area_dimensions) return req.area_dimensions;
      if (req?.area) return req.area;
      const dims = (data.extracted as { dimensions?: unknown[] })?.dimensions;
      if (dims?.length) return dims;
      return undefined;
    case "material_grade":
      if (req?.material_grade === "from_document") return "standard";
      return req?.material_grade ?? req?.tier_preference;
    case "site_access":
      return (
        req?.site_access ?? (data.site as { access_notes?: string })?.access_notes
      );
    case "deadline":
      return req?.deadline ?? req?.timeline;
    case "budget_range":
      return req?.budget_range ?? req?.budget;
    case "panel_capacity":
      return req?.panel_capacity;
    case "system_type":
      return req?.system_type;
    case "water_shutoff":
      return req?.water_shutoff;
    default:
      return req?.[field];
  }
}

function isAmbiguous(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (!t || t === "unknown" || t === "tbd" || t === "n/a") return true;
  }
  return false;
}

export function evaluateGapReadiness(
  checklist: TradeChecklistField[],
  data: Record<string, unknown>,
): GapReadinessResult {
  const missing: GapReadinessResult["missing"] = [];

  for (const item of checklist) {
    if (!item.required) continue;
    const value = getFieldValue(data, item.field);
    if (isAmbiguous(value)) {
      missing.push({
        field: item.field,
        why_needed: item.why_needed,
        question: item.question,
        priority: item.priority,
      });
    }
  }

  missing.sort((a, b) => a.priority - b.priority);

  return GapReadinessResultSchema.parse({
    ready_to_generate: missing.length === 0,
    missing,
  });
}

/** Drop fields already answered in data (after LLM or user message). */
export function reconcileGapMissing(
  gap: GapReadinessResult,
  checklist: TradeChecklistField[],
  data: Record<string, unknown>,
): GapReadinessResult {
  const deterministic = evaluateGapReadiness(checklist, data);
  const allowed = new Set(deterministic.missing.map((m) => m.field));
  const filtered = gap.missing.filter((m) => allowed.has(m.field));
  const merged =
    filtered.length > 0 ? filtered : deterministic.missing;
  merged.sort((a, b) => a.priority - b.priority);
  return GapReadinessResultSchema.parse({
    ready_to_generate: merged.length === 0,
    missing: merged,
  });
}
