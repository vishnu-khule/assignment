import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(join(root, "ROADMAP.md"), "utf8");
const children: Paragraph[] = [];

for (const line of md.split("\n")) {
  if (line.startsWith("# ")) {
    children.push(
      new Paragraph({
        text: line.slice(2),
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      }),
    );
    continue;
  }
  if (line.startsWith("## ")) {
    children.push(
      new Paragraph({
        text: line.slice(3),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }),
    );
    continue;
  }
  if (line.startsWith("### ")) {
    children.push(
      new Paragraph({
        text: line.slice(4),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
      }),
    );
    continue;
  }
  if (line.startsWith("|")) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line, font: "Courier New", size: 20 })],
      }),
    );
    continue;
  }
  if (line.trim() === "```" || line.startsWith("```")) {
    continue;
  }
  if (!line.trim()) {
    children.push(new Paragraph({ text: "" }));
    continue;
  }
  const bold = line.startsWith("**") && line.endsWith("**");
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: bold ? line.slice(2, -2) : line,
          bold,
        }),
      ],
    }),
  );
}

const doc = new Document({
  sections: [{ children }],
});

const outDir = join(root, "docs");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "ROADMAP.docx");
async function main() {
  const buf = await Packer.toBuffer(doc);
  writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
