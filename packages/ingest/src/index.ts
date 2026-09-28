import pdf from "pdf-parse";
import * as XLSX from "xlsx";

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType.includes("pdf") || buffer.subarray(0, 4).toString() === "%PDF") {
    const parsed = await pdf(buffer);
    return parsed.text?.trim() ?? "";
  }

  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.endsWith("sheet")
  ) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      parts.push(`Sheet: ${name}\n${csv}`);
    }
    return parts.join("\n\n");
  }

  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return buffer.toString("utf8");
  }

  return "";
}

export { imageMediaType, isImageMime } from "./media.js";

export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 100,
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    chunks.push(normalized.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}
