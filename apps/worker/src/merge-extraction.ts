import {
  getSessionById,
  isDbConfigured,
  updateSession,
} from "@proposal/db";
import type { ReferenceDocumentExtraction } from "@proposal/schemas";
import { SessionContextSchema } from "@proposal/schemas";

export async function mergeExtractionIntoSession(
  sessionId: string,
  extraction: ReferenceDocumentExtraction,
) {
  if (!isDbConfigured()) return;
  const row = await getSessionById(sessionId);
  if (!row) return;

  const context = SessionContextSchema.parse(row.context);
  const existing = Array.isArray(context.requirements.reference_extractions)
    ? (context.requirements.reference_extractions as ReferenceDocumentExtraction[])
    : [];

  await updateSession(sessionId, {
    context: {
      ...context,
      requirements: {
        ...context.requirements,
        reference_extractions: [...existing, extraction],
      },
    },
  });
}
