import type { ReferenceDocumentExtraction } from "@proposal/schemas";
import { mergeSpreadsheetIntoRequirements } from "./spreadsheet-estimate-parse.js";

/** Fill requirements from uploaded estimate/plan extractions (heuristic path when LLM is off). */
export function enrichRequirementsFromExtractions(
  requirements: Record<string, unknown>,
  extractions: ReferenceDocumentExtraction[],
): Record<string, unknown> {
  if (!extractions.length) return requirements;

  const next = { ...requirements };
  const lineItems = extractions.flatMap((e) => e.line_items ?? []);
  const scope = extractions.flatMap((e) => e.scope_of_work ?? []);
  const dims = extractions.flatMap((e) => e.dimensions ?? []);

  if (lineItems.length >= 2 && !next.work_summary) {
    const sample = lineItems
      .slice(0, 3)
      .map((i) => i.description)
      .filter(Boolean)
      .join("; ");
    next.work_summary =
      sample.length > 20
        ? `Scope from upload: ${sample}`
        : `Scope from upload (${lineItems.length} line items)`;
  } else if (scope.length && !next.work_summary) {
    next.work_summary = scope[0]?.text?.slice(0, 280) ?? "Scope from uploaded document";
  }

  if (dims.length && !next.area_sqm && !next.area_sqft && !next.area_dimensions) {
    const first = dims[0];
    next.area_from_document = dims
      .slice(0, 5)
      .map((d) => `${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""}`)
      .join("; ");
    if (first?.value) {
      next.area_dimensions = next.area_from_document;
      next.area_sqm = next.area_from_document;
    }
  }

  if (lineItems.length >= 5 && !next.material_grade) {
    next.material_grade = "from_document";
  }

  if (!next.site_address) {
    for (const e of extractions) {
      const name = e.source_file ?? "";
      const remodel = name.match(
        /\b(\d+\s+[\w\s-]+(?:street|st|road|rd|ave|lane|ln|muir|grand)[\w\s-]*)/i,
      );
      if (remodel?.[1]) {
        next.site_address = remodel[1].trim();
        break;
      }
    }
  }

  if (!next.deadline && scope.some((s) => /\basap|rush|urgent\b/i.test(s.text))) {
    next.deadline = "ASAP";
  }
  if (!next.site_access) {
    const accessHint = scope.find((s) =>
      /\b(stairs|parking|elevator|lift|access)\b/i.test(s.text),
    );
    if (accessHint) next.site_access = accessHint.text.slice(0, 120);
  }

  next.document_context = {
    line_item_count: lineItems.length,
    scope_snippets: scope.length,
    dimension_count: dims.length,
    sources: extractions.map((e) => e.source_file),
  };

  return mergeSpreadsheetIntoRequirements(next, extractions);
}
