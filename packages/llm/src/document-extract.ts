import {
  ReferenceDocumentExtractionSchema,
  type ReferenceDocumentExtraction,
} from "@proposal/schemas";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { completeChat, getOpenAI, primaryModel } from "./client.js";
import { extractDocumentHeuristic } from "./document-extract-heuristic.js";

export const DOCUMENT_EXTRACT_SYSTEM_PROMPT = `You analyse a reference document (old proposal, estimate, drawing, or photo).
Extract: line items (description, unit, qty, unit_price), labour rates, material
brands, scope of work, terms, warranty, payment schedule, dimensions, and
company style/tone. For drawings, list rooms, measurements, and fixtures.
Mark each field with source_file and page. Return JSON only; use null when not present.

Output must match this shape:
{
  "source_file": string,
  "document_type": "proposal" | "estimate" | "drawing" | "photo" | "spreadsheet" | "other",
  "line_items": [{ description, unit, qty, unit_price, source_file, page }] | null,
  "labour_rates": [{ role, rate, unit, source_file, page }] | null,
  "material_brands": [{ brand, material, category, source_file, page }] | null,
  "scope_of_work": [{ text, source_file, page }] | null,
  "terms": { text, source_file, page } | null,
  "warranty": { text, source_file, page } | null,
  "payment_schedule": [{ milestone, percent, amount, due, source_file, page }] | null,
  "dimensions": [{ label, value, unit, source_file, page }] | null,
  "company_style": { tone, notes, source_file, page } | null,
  "drawing_details": { rooms: [...], fixtures: [...] } | null
}

Rules:
- source_file must be the provided filename for every record.
- page is 1-based page number when known; null for photos or unknown.
- Do not invent numbers; use null for missing qty/unit_price.
- For photos/drawings without text, describe visible scope in scope_of_work and drawing_details.`;

export interface ExtractDocumentInput {
  filename: string;
  mimeType: string;
  textContent: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export async function extractReferenceDocument(
  input: ExtractDocumentInput,
): Promise<ReferenceDocumentExtraction> {
  if (!getOpenAI()) {
    return extractDocumentHeuristic(input);
  }

  const userContent: ChatCompletionContentPart[] = [];

  if (input.imageBase64 && input.imageMediaType) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${input.imageMediaType};base64,${input.imageBase64}`,
      },
    });
  }

  userContent.push({
    type: "text",
    text: JSON.stringify({
      source_file: input.filename,
      mime_type: input.mimeType,
      extracted_text: input.textContent.slice(0, 80_000),
    }),
  });

  const text = await completeChat({
    model: primaryModel(),
    max_tokens: 8192,
    system: DOCUMENT_EXTRACT_SYSTEM_PROMPT,
    user: userContent,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return extractDocumentHeuristic(input);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    parsed.source_file = parsed.source_file ?? input.filename;
    const result = ReferenceDocumentExtractionSchema.parse(parsed);
    if (
      (result.line_items?.length ?? 0) < 2 &&
      (input.mimeType.includes("sheet") ||
        input.filename.toLowerCase().endsWith(".xlsx"))
    ) {
      const sheet = extractDocumentHeuristic(input);
      if ((sheet.line_items?.length ?? 0) > (result.line_items?.length ?? 0)) {
        return sheet;
      }
      if (
        sheet.scope_of_work?.[0]?.text &&
        !(result.scope_of_work?.[0]?.text?.includes("Scope:"))
      ) {
        return {
          ...result,
          scope_of_work: sheet.scope_of_work,
          dimensions: sheet.dimensions ?? result.dimensions,
          line_items: sheet.line_items ?? result.line_items,
        };
      }
    }
    return result;
  } catch {
    return extractDocumentHeuristic(input);
  }
}
