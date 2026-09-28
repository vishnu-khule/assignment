import type { SessionContext } from "@proposal/schemas";
import type { ReferenceDocumentExtraction } from "@proposal/schemas";

/** Snippets from past proposals to mimic tone (not prices). */
export function extractToneSamples(context: SessionContext): string[] {
  const extractions = Array.isArray(context.requirements.reference_extractions)
    ? (context.requirements.reference_extractions as ReferenceDocumentExtraction[])
    : [];

  const samples: string[] = [];
  for (const ext of extractions) {
    if (ext.company_style?.tone) samples.push(ext.company_style.tone);
    if (ext.company_style?.notes) samples.push(ext.company_style.notes);
    for (const s of ext.scope_of_work ?? []) {
      if (s.text.length < 400) samples.push(s.text);
    }
  }
  return samples.slice(0, 6);
}
