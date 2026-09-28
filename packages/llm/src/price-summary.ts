import type { TierPricing } from "@proposal/schemas";

/** Deterministic price block — LLM must not invent these figures. */
export function formatPriceSummary(
  pricing: TierPricing,
  currency: string,
): string {
  const lines = [
    "Price summary",
    `Materials & labor subtotal (before tax): ${currency} ${pricing.subtotal.toFixed(2)}`,
    `Tax: ${currency} ${pricing.tax.toFixed(2)}`,
    `Total: ${currency} ${pricing.total.toFixed(2)}`,
    `Quote valid until: ${pricing.valid_until}`,
  ];
  if (pricing.line_items.length > 0) {
    lines.push("", "Line items:");
    for (const li of pricing.line_items) {
      lines.push(
        `• ${li.description}: ${li.qty} ${li.unit} @ ${currency} ${li.unit_price.toFixed(2)} = ${currency} ${li.extended.toFixed(2)}`,
      );
    }
  }
  return lines.join("\n");
}
