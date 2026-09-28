import {
  ReferenceDocumentExtractionSchema,
  type ReferenceDocumentExtraction,
} from "@proposal/schemas";
import type { ExtractDocumentInput } from "./document-extract.js";
import { parseSpreadsheetEstimateText } from "./spreadsheet-estimate-parse.js";

function inferDocType(
  filename: string,
  mime: string,
): ReferenceDocumentExtraction["document_type"] {
  const f = filename.toLowerCase();
  if (mime.startsWith("image/")) return "photo";
  if (f.includes("draw") || f.includes("plan")) return "drawing";
  if (f.includes("estimate") || f.includes("quote")) return "estimate";
  if (mime.includes("sheet") || f.endsWith(".xlsx") || f.endsWith(".csv")) {
    return "spreadsheet";
  }
  if (f.includes("proposal")) return "proposal";
  return "other";
}

export function extractDocumentHeuristic(
  input: ExtractDocumentInput,
): ReferenceDocumentExtraction {
  const source_file = input.filename;
  const page = null;
  const docType = inferDocType(source_file, input.mimeType);

  if (
    docType === "spreadsheet" ||
    docType === "estimate" ||
    input.mimeType.includes("sheet") ||
    input.filename.toLowerCase().endsWith(".xlsx")
  ) {
    const parsed = parseSpreadsheetEstimateText(
      input.textContent,
      source_file,
    );
    if (parsed.line_items?.length || parsed.scope_of_work?.length) {
      return ReferenceDocumentExtractionSchema.parse({
        source_file,
        document_type: docType,
        line_items: parsed.line_items,
        labour_rates: null,
        material_brands: null,
        scope_of_work: parsed.scope_of_work,
        terms: null,
        warranty: null,
        payment_schedule: null,
        dimensions: parsed.dimensions,
        company_style: null,
        drawing_details: null,
      });
    }
  }

  const line_items: ReferenceDocumentExtraction["line_items"] = [];
  const lines = input.textContent.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+(\d+(?:\.\d+)?)\s*$/,
    );
    if (m) {
      line_items.push({
        description: m[1].trim(),
        qty: Number(m[2]),
        unit: m[3],
        unit_price: Number(m[4]),
        source_file,
        page,
      });
    }
  }

  const scope_of_work =
    input.textContent.trim().length > 0
      ? [
          {
            text: input.textContent.trim().slice(0, 500),
            source_file,
            page,
          },
        ]
      : null;

  return ReferenceDocumentExtractionSchema.parse({
    source_file,
    document_type: docType,
    line_items: line_items.length ? line_items : null,
    labour_rates: null,
    material_brands: null,
    scope_of_work,
    terms: null,
    warranty: null,
    payment_schedule: null,
    dimensions: null,
    company_style: null,
    drawing_details:
      docType === "drawing" || docType === "photo"
        ? { rooms: null, fixtures: null }
        : null,
  });
}
