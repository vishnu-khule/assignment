import type { ProposalSnapshot } from "@proposal/schemas";

export function formatAssumptionsText(snapshot: ProposalSnapshot): string[] {
  if (snapshot.documented_assumptions?.length) {
    return snapshot.documented_assumptions.map(
      (a) => `${a.field}: ${a.assumed_value} — ${a.reason}`,
    );
  }
  return snapshot.assumptions;
}

export function assumptionsSectionHtml(snapshot: ProposalSnapshot): string {
  const lines = formatAssumptionsText(snapshot);
  if (!lines.length) return "";
  const items = lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  return `<h2>Assumptions</h2><ul>${items}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
