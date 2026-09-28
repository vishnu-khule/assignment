/** Template renderers only — snapshot JSON → PDF / DOCX / XLSX (no LLM). */
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { ProposalSnapshot, TierKey } from "@proposal/schemas";
import { assumptionsSectionHtml, formatAssumptionsText } from "./assumptions.js";
import {
  documentSectionsHtml,
  documentSectionsPlainBlocks,
  getDocumentSections,
} from "./document-sections.js";
import {
  initPdfDocument,
  writePdfAssumptions,
  writePdfCoverHeader,
  writePdfFooters,
  writePdfLineItemsTable,
  writePdfSection,
} from "./pdf-layout.js";

function tierBundle(snapshot: ProposalSnapshot, tier: TierKey) {
  return snapshot.tiers[tier];
}

function writePdfProposalNarrative(
  doc: ReturnType<typeof initPdfDocument>,
  snapshot: ProposalSnapshot,
  tier: TierKey,
) {
  const bundle = tierBundle(snapshot, tier);
  const sections = getDocumentSections(snapshot, tier);
  if (sections) {
    for (const block of documentSectionsPlainBlocks(sections)) {
      if (block.title === "Price summary" || block.title === "Assumptions") {
        continue;
      }
      writePdfSection(doc, block.title, block.body);
    }
    const assumptionBody = sections.assumptions?.trim();
    if (assumptionBody) {
      writePdfSection(doc, "Assumptions", assumptionBody);
    }
  } else {
    writePdfSection(doc, "Summary", bundle.narrative.summary);
    writePdfSection(doc, "Scope of work", bundle.narrative.scope);
  }
  const extraAssumptions = formatAssumptionsText(snapshot);
  writePdfAssumptions(doc, extraAssumptions);
}

function writePdfEstimateBody(
  doc: ReturnType<typeof initPdfDocument>,
  snapshot: ProposalSnapshot,
  tier: TierKey,
) {
  const bundle = tierBundle(snapshot, tier);
  if (bundle.pricing.line_items.length > 0) {
    writePdfLineItemsTable(doc, bundle.pricing, snapshot.currency);
  }
  if (snapshot.bill_of_quantities?.items?.length) {
    doc.moveDown(0.5);
    const boqLines = snapshot.bill_of_quantities.items
      .slice(0, 40)
      .map(
        (item) =>
          `• [${item.tier}] ${item.description} — ${item.qty} ${item.unit}`,
      );
    writePdfSection(doc, "Bill of quantities (reference)", boqLines.join("\n"));
  }
}


export function renderProposalHtml(snapshot: ProposalSnapshot, tier: TierKey): string {
  const bundle = tierBundle(snapshot, tier);
  const lines = bundle.pricing.line_items
    .map(
      (li) =>
        `<tr><td>${li.description}</td><td>${li.qty}</td><td>${li.unit}</td><td>${li.unit_price.toFixed(2)}</td><td>${li.extended.toFixed(2)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#111}
    h1{font-size:20px} h2{font-size:14px;margin-top:20px} table{width:100%;border-collapse:collapse;margin-top:16px}
    td,th{border:1px solid #ddd;padding:8px;font-size:12px} th{text-align:left;background:#f8fafc}
    ul{font-size:12px;line-height:1.5}
  </style></head><body>
    <h1>${snapshot.branding.company_name} — ${tier} proposal</h1>
    <p><strong>Customer:</strong> ${snapshot.customer.name}</p>
    ${
      getDocumentSections(snapshot, tier)
        ? documentSectionsHtml(getDocumentSections(snapshot, tier)!)
        : `<p>${bundle.narrative.summary}</p><p>${bundle.narrative.scope}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
    <p><strong>Total:</strong> ${snapshot.currency} ${bundle.pricing.total.toFixed(2)}</p>
    ${assumptionsSectionHtml(snapshot)}`
    }
  </body></html>`;
}

export async function renderPdfProposal(
  snapshot: ProposalSnapshot,
  tier: TierKey,
): Promise<Buffer> {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const doc = initPdfDocument();
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  writePdfCoverHeader(doc, snapshot, tier, `${tierLabel} proposal`);
  writePdfProposalNarrative(doc, snapshot, tier);
  writePdfFooters(doc, `${snapshot.branding.company_name} · ${tierLabel} proposal`);
  doc.end();
  return done;
}

export async function renderPdfEstimate(
  snapshot: ProposalSnapshot,
  tier: TierKey,
): Promise<Buffer> {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const doc = initPdfDocument();
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  writePdfCoverHeader(doc, snapshot, tier, `${tierLabel} cost estimate`);
  writePdfSection(
    doc,
    "Estimate summary",
    `All amounts in ${snapshot.currency}. Itemized pricing and quantities below.`,
  );
  writePdfEstimateBody(doc, snapshot, tier);
  writePdfFooters(
    doc,
    `${snapshot.branding.company_name} · ${tierLabel} estimate`,
  );
  doc.end();
  return done;
}

/** Combined document: Part A proposal narrative, Part B cost estimate. */
export async function renderPdf(
  snapshot: ProposalSnapshot,
  tier: TierKey,
): Promise<Buffer> {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const doc = initPdfDocument();
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  writePdfCoverHeader(
    doc,
    snapshot,
    tier,
    `${tierLabel} proposal & cost estimate`,
  );
  writePdfSection(doc, "Part A — Proposal", "");
  writePdfProposalNarrative(doc, snapshot, tier);
  doc.addPage();
  writePdfSection(
    doc,
    "Part B — Cost estimate",
    `All amounts in ${snapshot.currency}.`,
  );
  writePdfEstimateBody(doc, snapshot, tier);

  writePdfFooters(
    doc,
    `${snapshot.branding.company_name} · ${tierLabel} proposal & estimate`,
  );

  doc.end();
  return done;
}

export async function renderXlsx(
  snapshot: ProposalSnapshot,
  tier: TierKey,
): Promise<Buffer> {
  const bundle = tierBundle(snapshot, tier);
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet("Summary");
  summary.addRow([snapshot.branding.company_name, `${tier} proposal`]);
  summary.addRow(["Customer", snapshot.customer.name]);
  if (snapshot.site?.address) summary.addRow(["Site", snapshot.site.address]);
  summary.addRow(["Currency", snapshot.currency]);
  summary.addRow(["Total", bundle.pricing.total]);
  summary.addRow([]);

  const sheet = wb.addWorksheet("Line items");
  sheet.addRow(["Description", "Qty", "Unit", "Unit Price", "Extended"]);
  for (const li of bundle.pricing.line_items) {
    sheet.addRow([li.description, li.qty, li.unit, li.unit_price, li.extended]);
  }
  sheet.addRow([]);
  sheet.addRow(["Subtotal", bundle.pricing.subtotal]);
  sheet.addRow(["Tax", bundle.pricing.tax]);
  sheet.addRow(["Total", bundle.pricing.total]);

  const assumptionLines = formatAssumptionsText(snapshot);
  if (assumptionLines.length > 0) {
    const audit = wb.addWorksheet("Assumptions");
    audit.addRow(["Field", "Assumed value", "Reason"]);
    if (snapshot.documented_assumptions?.length) {
      for (const a of snapshot.documented_assumptions) {
        audit.addRow([a.field, a.assumed_value, a.reason]);
      }
    } else {
      for (const line of assumptionLines) {
        audit.addRow([line, "", ""]);
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function renderDocx(
  snapshot: ProposalSnapshot,
  tier: TierKey,
): Promise<Buffer> {
  const bundle = tierBundle(snapshot, tier);
  const sections = getDocumentSections(snapshot, tier);
  const sectionParagraphs = sections
    ? documentSectionsPlainBlocks(sections).flatMap((block) => [
        new Paragraph({
          children: [new TextRun({ text: block.title, bold: true })],
        }),
        new Paragraph(block.body),
      ])
    : [
        new Paragraph(bundle.narrative.summary),
        new Paragraph(bundle.narrative.scope),
        ...bundle.pricing.line_items.map(
          (li) =>
            new Paragraph(
              `${li.description}: ${li.qty} ${li.unit} @ ${li.unit_price} = ${li.extended}`,
            ),
        ),
        new Paragraph(`Total: ${snapshot.currency} ${bundle.pricing.total}`),
      ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `${snapshot.branding.company_name} — ${tier} proposal`,
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph(`Customer: ${snapshot.customer.name}`),
          ...(snapshot.site?.address
            ? [new Paragraph(`Site: ${snapshot.site.address}`)]
            : []),
          ...sectionParagraphs,
          new Paragraph({
            children: [new TextRun({ text: "Itemized estimate", bold: true })],
          }),
          ...bundle.pricing.line_items.map(
            (li) =>
              new Paragraph(
                `${li.description}: ${li.qty} ${li.unit} @ ${snapshot.currency} ${li.unit_price.toFixed(2)} = ${li.extended.toFixed(2)}`,
              ),
          ),
          new Paragraph({
            children: [
              new TextRun({
                text: `Total: ${snapshot.currency} ${bundle.pricing.total.toFixed(2)}`,
                bold: true,
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
