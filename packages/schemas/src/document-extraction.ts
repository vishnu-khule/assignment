import { z } from "zod";

/** Provenance on every extracted record. */
export const SourceRefSchema = z.object({
  source_file: z.string(),
  page: z.number().int().positive().nullable(),
});

export const ExtractedLineItemSchema = SourceRefSchema.extend({
  description: z.string(),
  unit: z.string().nullable(),
  qty: z.number().nullable(),
  unit_price: z.number().nullable(),
});

export const ExtractedLabourRateSchema = SourceRefSchema.extend({
  role: z.string().nullable(),
  rate: z.number().nullable(),
  unit: z.string().nullable(),
});

export const ExtractedMaterialBrandSchema = SourceRefSchema.extend({
  brand: z.string().nullable(),
  material: z.string().nullable(),
  category: z.string().nullable(),
});

export const ExtractedScopeItemSchema = SourceRefSchema.extend({
  text: z.string(),
});

export const ExtractedPaymentMilestoneSchema = SourceRefSchema.extend({
  milestone: z.string().nullable(),
  percent: z.number().nullable(),
  amount: z.number().nullable(),
  due: z.string().nullable(),
});

export const ExtractedDimensionSchema = SourceRefSchema.extend({
  label: z.string().nullable(),
  value: z.string().nullable(),
  unit: z.string().nullable(),
});

export const ExtractedRoomSchema = SourceRefSchema.extend({
  name: z.string().nullable(),
  measurements: z.string().nullable(),
});

export const ExtractedFixtureSchema = SourceRefSchema.extend({
  name: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
});

export const SourcedTextSchema = SourceRefSchema.extend({
  text: z.string().nullable(),
});

export const CompanyStyleSchema = SourceRefSchema.extend({
  tone: z.string().nullable(),
  notes: z.string().nullable(),
});

export const DrawingDetailsSchema = z
  .object({
    rooms: z.array(ExtractedRoomSchema).nullable(),
    fixtures: z.array(ExtractedFixtureSchema).nullable(),
  })
  .nullable();

export const ReferenceDocumentExtractionSchema = z.object({
  source_file: z.string(),
  document_type: z.enum([
    "proposal",
    "estimate",
    "drawing",
    "photo",
    "spreadsheet",
    "other",
  ]),
  line_items: z.array(ExtractedLineItemSchema).nullable(),
  labour_rates: z.array(ExtractedLabourRateSchema).nullable(),
  material_brands: z.array(ExtractedMaterialBrandSchema).nullable(),
  scope_of_work: z.array(ExtractedScopeItemSchema).nullable(),
  terms: SourcedTextSchema.nullable(),
  warranty: SourcedTextSchema.nullable(),
  payment_schedule: z.array(ExtractedPaymentMilestoneSchema).nullable(),
  dimensions: z.array(ExtractedDimensionSchema).nullable(),
  company_style: CompanyStyleSchema.nullable(),
  drawing_details: DrawingDetailsSchema,
});

export type ReferenceDocumentExtraction = z.infer<
  typeof ReferenceDocumentExtractionSchema
>;
