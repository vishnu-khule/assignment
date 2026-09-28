import { z } from "zod";
import { SessionContextSchema } from "./session.js";

export const IngestJobPayloadSchema = z.object({
  attachment_id: z.string().uuid(),
  session_id: z.string().uuid(),
  org_id: z.string(),
  storage_key: z.string(),
  mime_type: z.string(),
  filename: z.string(),
});

export const GenerateJobPayloadSchema = z.object({
  session_id: z.string().uuid(),
  org_id: z.string(),
  context: SessionContextSchema,
});

export const ExportJobPayloadSchema = z.object({
  snapshot_id: z.string().uuid(),
  org_id: z.string(),
  formats: z.array(z.enum(["pdf", "docx", "xlsx"])),
});

export type IngestJobPayload = z.infer<typeof IngestJobPayloadSchema>;
export type GenerateJobPayload = z.infer<typeof GenerateJobPayloadSchema>;
export type ExportJobPayload = z.infer<typeof ExportJobPayloadSchema>;
