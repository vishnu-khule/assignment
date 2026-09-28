import type { DocumentedAssumption } from "@proposal/schemas";
import type { GapReadinessResult } from "@proposal/schemas";

const DEFAULTS: Record<string, { value: string; reason: string }> = {
  area_sqm: {
    value: "Typical room size — to be verified on site",
    reason: "Area not provided; using indicative placeholder for estimate only.",
  },
  material_grade: {
    value: "standard",
    reason: "Material grade not specified; defaulting to mid-tier (Modern) pricing.",
  },
  site_access: {
    value: "Normal access during business hours",
    reason: "Site access not described; assuming no special restrictions.",
  },
  deadline: {
    value: "Within 2–4 weeks",
    reason: "No deadline given; using standard scheduling window.",
  },
  site_address: {
    value: "Address to be confirmed",
    reason: "Site address missing; travel and tax may change after confirmation.",
  },
  work_summary: {
    value: "Scope as discussed in chat and attachments",
    reason: "Work summary incomplete; derived from conversation context.",
  },
  panel_capacity: {
    value: "Unknown — allow for 200A upgrade",
    reason: "Panel size not confirmed; pricing may include upgrade allowance.",
  },
  system_type: {
    value: "Repair / partial replacement",
    reason: "System scope unclear; assuming repair unless noted otherwise.",
  },
  budget_range: {
    value: "Not provided",
    reason: "No budget range; all three tiers will be shown.",
  },
};

export function buildDocumentedAssumptions(
  missing: GapReadinessResult["missing"],
): DocumentedAssumption[] {
  return missing.map((m) => {
    const def = DEFAULTS[m.field] ?? {
      value: "To be confirmed on site",
      reason: `${m.field} was not provided.`,
    };
    return {
      field: m.field,
      assumed_value: def.value,
      reason: def.reason,
    };
  });
}

export function assumptionsSummaryMarkdown(
  assumptions: DocumentedAssumption[],
): string {
  const lines = assumptions.map(
    (a) => `• ${a.field}: ${a.assumed_value} — ${a.reason}`,
  );
  return `I'll use these assumptions for the estimate:\n\n${lines.join("\n")}\n\nTap Generate 3 tiers when you're ready. You can still correct anything before sharing.`;
}
