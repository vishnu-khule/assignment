import PDFDocument from "pdfkit";
import type { ProposalSnapshot, TierKey, TierPricing } from "@proposal/schemas";

const MARGIN = 54;
const PAGE_WIDTH = 612;
const CONTENT_W = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  brand: "#0f766e",
  brandDark: "#115e59",
  ink: "#0f172a",
  muted: "#475569",
  line: "#e2e8f0",
  panel: "#f8fafc",
  white: "#ffffff",
};

type Doc = InstanceType<typeof PDFDocument>;

export function initPdfDocument(): Doc {
  return new PDFDocument({
    size: "LETTER",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: "Proposal",
      Author: "Proposal Estimator",
    },
  });
}

export function writePdfFooters(doc: Doc, footerLabel: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(footerLabel, MARGIN, 756, {
        width: CONTENT_W,
        align: "center",
        lineBreak: false,
      });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN, 768, {
      width: CONTENT_W,
      align: "center",
      lineBreak: false,
    });
  }
  doc.fillColor(COLORS.ink);
}

export function writePdfCoverHeader(
  doc: Doc,
  snapshot: ProposalSnapshot,
  tier: TierKey,
  subtitle?: string,
) {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const headerH = 88;
  const top = doc.y;
  doc.save();
  doc.rect(MARGIN, top, CONTENT_W, headerH).fill(COLORS.brand);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(20);
  doc.text(snapshot.branding.company_name, MARGIN + 16, top + 16, {
    width: CONTENT_W - 32,
    lineBreak: false,
  });
  doc.font("Helvetica").fontSize(11);
  doc.text(subtitle ?? `${tierLabel} proposal & estimate`, MARGIN + 16, top + 42, {
    width: CONTENT_W - 32,
    lineBreak: false,
  });
  doc.fontSize(9).text(
    new Date(snapshot.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    MARGIN + 16,
    top + 60,
    { lineBreak: false },
  );
  doc.restore();
  doc.y = top + headerH + 16;

  const metaY = doc.y;
  const colW = CONTENT_W / 2 - 8;
  doc.save();
  doc.roundedRect(MARGIN, metaY, CONTENT_W, 72, 6).fill(COLORS.panel);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(9);
  doc.text("Customer", MARGIN + 14, metaY + 12);
  doc.font("Helvetica").fontSize(10);
  doc.text(snapshot.customer.name, MARGIN + 14, metaY + 26, { width: colW });

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Project details", MARGIN + colW + 22, metaY + 12);
  doc.font("Helvetica").fontSize(10);
  const rightLines = [
    snapshot.site?.address ? `Site: ${snapshot.site.address}` : null,
    `Currency: ${snapshot.currency}`,
    `Quote valid until: ${snapshot.tiers[tier].pricing.valid_until}`,
  ].filter(Boolean) as string[];
  doc.text(rightLines.join("\n"), MARGIN + colW + 22, metaY + 26, {
    width: colW,
    lineGap: 2,
  });
  doc.restore();
  doc.y = metaY + 88;
}

export function writePdfSection(
  doc: Doc,
  title: string,
  body: string,
) {
  ensureSpace(doc, 80);
  const titleY = doc.y;
  doc.save();
  doc.rect(MARGIN, titleY, 4, 18).fill(COLORS.brand);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.brandDark);
  doc.text(title, MARGIN + 12, titleY + 2);
  doc.y = titleY + 22;

  doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink);
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      doc.moveDown(0.3);
      continue;
    }
    const isBullet = /^[•\-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);
    if (isBullet) {
      doc.text(trimmed.replace(/^[•\-*]\s*/, "• "), {
        indent: 12,
        lineGap: 4,
        width: CONTENT_W - 12,
      });
    } else {
      doc.text(trimmed, { lineGap: 4, width: CONTENT_W });
    }
    if (doc.y > 700) {
      doc.addPage();
      doc.y = MARGIN;
    }
  }
  doc.moveDown(0.8);
}

function ensureSpace(doc: Doc, min: number) {
  if (doc.y + min > 720) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

export function writePdfLineItemsTable(
  doc: Doc,
  pricing: TierPricing,
  currency: string,
) {
  ensureSpace(doc, 120);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.ink);
  doc.text("Itemized estimate", MARGIN, doc.y);
  doc.moveDown(0.6);

  const widths = [0.42, 0.08, 0.1, 0.18, 0.22].map((f) => f * CONTENT_W);
  const headers = ["Description", "Qty", "Unit", "Unit rate", "Amount"];
  drawTableHeader(doc, headers, widths);

  for (const li of pricing.line_items) {
    const cells = [
      li.description,
      String(li.qty),
      li.unit,
      `${currency} ${li.unit_price.toFixed(2)}`,
      `${currency} ${li.extended.toFixed(2)}`,
    ];
    drawTableRow(doc, cells, widths);
  }

  doc.moveDown(0.5);
  const totalsX = MARGIN + CONTENT_W * 0.55;
  const totalsW = CONTENT_W * 0.45;
  let ty = doc.y;
  doc.save();
  doc.roundedRect(totalsX, ty, totalsW, 72, 4).fill(COLORS.panel);
  doc.restore();
  ty += 12;
  const innerW = totalsW - 24;
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted);
  doc.text("Subtotal", totalsX + 12, ty, { width: innerW / 2, lineBreak: false });
  doc.text(`${currency} ${pricing.subtotal.toFixed(2)}`, totalsX + 12 + innerW / 2, ty, {
    width: innerW / 2,
    align: "right",
    lineBreak: false,
  });
  ty += 16;
  doc.text("Tax", totalsX + 12, ty, { width: innerW / 2, lineBreak: false });
  doc.text(`${currency} ${pricing.tax.toFixed(2)}`, totalsX + 12 + innerW / 2, ty, {
    width: innerW / 2,
    align: "right",
    lineBreak: false,
  });
  ty += 18;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.brandDark);
  doc.text("Total", totalsX + 12, ty, { width: innerW / 2, lineBreak: false });
  doc.text(`${currency} ${pricing.total.toFixed(2)}`, totalsX + 12 + innerW / 2, ty, {
    width: innerW / 2,
    align: "right",
    lineBreak: false,
  });
  doc.y = ty + 28;
}

function drawTableHeader(doc: Doc, headers: string[], widths: number[]) {
  const y = doc.y;
  const rowH = 22;
  doc.save();
  doc.rect(MARGIN, y, CONTENT_W, rowH).fill(COLORS.brandDark);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(9);
  let x = MARGIN + 8;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, y + 7, {
      width: widths[i] - 8,
      lineBreak: false,
    });
    x += widths[i];
  }
  doc.restore();
  doc.y = y + rowH;
}

function drawTableRow(doc: Doc, cells: string[], widths: number[]) {
  const pad = 8;
  doc.fontSize(9);
  const heights = cells.map((cell, i) =>
    doc.heightOfString(cell, { width: widths[i] - pad }),
  );
  const rowH = Math.max(20, ...heights) + 10;
  ensureSpace(doc, rowH + 4);

  const y = doc.y;
  doc.save();
  doc.rect(MARGIN, y, CONTENT_W, rowH).fill(COLORS.white);
  doc
    .moveTo(MARGIN, y + rowH)
    .lineTo(MARGIN + CONTENT_W, y + rowH)
    .strokeColor(COLORS.line)
    .stroke();
  doc.restore();

  doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink);
  let x = MARGIN + 4;
  for (let i = 0; i < cells.length; i++) {
    const align: "left" | "right" = i >= 3 ? "right" : "left";
    const opts = {
      width: widths[i] - pad,
      align,
      lineGap: 1,
      lineBreak: i !== 0,
    };
    doc.text(cells[i], x + 4, y + 6, opts);
    x += widths[i];
  }
  doc.y = y + rowH;
}

export function writePdfAssumptions(
  doc: Doc,
  lines: string[],
) {
  if (!lines.length) return;
  writePdfSection(
    doc,
    "Additional assumptions",
    lines.map((l) => `• ${l}`).join("\n"),
  );
}
