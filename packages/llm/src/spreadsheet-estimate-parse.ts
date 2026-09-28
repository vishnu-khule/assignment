import type { ReferenceDocumentExtraction } from "@proposal/schemas";

/** Parse Kodiak-style estimate CSV text from xlsx ingest. */
export function parseSpreadsheetEstimateText(
  textContent: string,
  source_file: string,
): Pick<
  ReferenceDocumentExtraction,
  "line_items" | "scope_of_work" | "dimensions"
> {
  const page = null;
  const line_items: NonNullable<ReferenceDocumentExtraction["line_items"]> = [];

  const scopeMatch = textContent.match(
    /\bScope:\s*,?\s*"?([^"\n]+)"?/i,
  );
  const addressMatch = textContent.match(
    /\bAddress:\s*,?\s*"?([^"\n]+)"?/i,
  );
  const projectMatch = textContent.match(
    /\bProject:\s*,?\s*"?([^"\n]+)"?/i,
  );

  const scopeText = scopeMatch?.[1]?.trim();
  const scope_of_work = scopeText
    ? [{ text: scopeText, source_file, page }]
    : textContent.trim().length > 80
      ? [{ text: textContent.trim().slice(0, 4000), source_file, page }]
      : null;

  const dimensions: NonNullable<ReferenceDocumentExtraction["dimensions"]> = [];
  if (scopeText) {
    const sf = scopeText.match(/(\d+(?:\.\d+)?)\s*sf\b/i);
    if (sf) {
      dimensions.push({
        label: "floor area",
        value: sf[1],
        unit: "sf",
        source_file,
        page,
      });
    }
  }

  for (const line of textContent.split(/\r?\n/)) {
    if (!line.includes(",") || line.startsWith("Sheet:")) continue;
    const lower = line.toLowerCase();
    if (
      lower.includes("description") &&
      (lower.includes("qty") || lower.includes("amount") || lower.includes("cost"))
    ) {
      continue;
    }
    const cols = splitCsvLine(line);
    if (cols.length < 2) continue;
    const desc = cols[0]?.replace(/^"|"$/g, "").trim();
    if (!desc || desc.length < 3) continue;
    if (/^(total|subtotal|tax|grand|project|address|scope|sheet)/i.test(desc)) {
      continue;
    }
    const nums = cols
      .slice(1)
      .map((c) => parseFloat(c.replace(/[$,%]/g, "")))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (nums.length === 0 && cols.length < 3) continue;

    line_items.push({
      description: desc.slice(0, 240),
      qty: nums.length >= 2 ? nums[0] : nums[0] ?? 1,
      unit: cols[1] && !nums.includes(parseFloat(cols[1])) ? cols[1] : "ea",
      unit_price: nums.length >= 2 ? nums[nums.length - 1] : nums[0] ?? null,
      source_file,
      page,
    });
    if (line_items.length >= 40) break;
  }

  return {
    line_items: line_items.length ? line_items : null,
    scope_of_work,
    dimensions: dimensions.length ? dimensions : null,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function mergeSpreadsheetIntoRequirements(
  requirements: Record<string, unknown>,
  extractions: ReferenceDocumentExtraction[],
): Record<string, unknown> {
  const next = { ...requirements };
  for (const ext of extractions) {
    const blob =
      ext.scope_of_work?.[0]?.text ??
      (ext.line_items?.length ? "" : "");
    if (!blob) continue;

    const scopeM = blob.match(/\bScope:\s*,?\s*"?([^"\n]+)"?/i);
    if (scopeM?.[1] && !next.work_summary) {
      next.work_summary = scopeM[1].trim().slice(0, 600);
    }
    const addrM = blob.match(/\bAddress:\s*,?\s*"?([^"\n]+)"?/i);
    if (addrM?.[1] && !next.site_address) {
      next.site_address = addrM[1].trim().slice(0, 280);
    }
    const projM = blob.match(/\bProject:\s*,?\s*"?([^"\n]+)"?/i);
    if (projM?.[1] && !next.project_name) {
      next.project_name = projM[1].trim();
    }
    for (const dim of ext.dimensions ?? []) {
      if (dim.unit?.toLowerCase() === "sf" && dim.value && !next.area_sqft) {
        next.area_sqft = parseFloat(dim.value);
        next.area_dimensions = `${dim.value} sf (from ${ext.source_file})`;
      }
    }
  }
  return next;
}
