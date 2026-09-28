import { useState } from "react";
import { api, type ProposalTierOption } from "../lib/api";
import { LineItemEditor } from "./LineItemEditor";

const TIERS = ["basic", "modern", "premium"] as const;
type Tier = (typeof TIERS)[number];

export function ProposalResultPanel({
  sessionId,
  snapshotId,
  currency,
  options,
  documentedAssumptions,
  onEditChat,
  onShared,
  onLineItemsSaved,
}: {
  sessionId: string;
  snapshotId: string;
  currency: string;
  options: Record<Tier, ProposalTierOption>;
  documentedAssumptions?: {
    field: string;
    assumed_value: string;
    reason: string;
  }[] | null;
  onEditChat: () => void;
  onShared: (url: string) => void;
  onLineItemsSaved?: () => void;
}) {
  const [tier, setTier] = useState<Tier>("modern");
  const [editingLines, setEditingLines] = useState(false);
  const bundle = options[tier];
  const sections = bundle.document_sections;

  async function download(format: "pdf" | "xlsx") {
    const { url } = await api.exportUrl(sessionId, tier, format);
    window.open(url, "_blank");
  }

  async function share() {
    const { url } = await api.createShare(snapshotId, tier);
    onShared(url);
    await navigator.clipboard.writeText(url).catch(() => undefined);
  }

  return (
    <>
    {editingLines && (
      <LineItemEditor
        tier={tier}
        currency={currency}
        bundle={bundle}
        onClose={() => setEditingLines(false)}
        onSave={async (line_items) => {
          await api.patchLineItems(sessionId, tier, line_items);
          onLineItemsSaved?.();
        }}
      />
    )}
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="px-4 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Proposal options
        </h2>
        <div className="mt-2 flex gap-1 rounded-xl bg-slate-200/60 p-1">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition ${
                tier === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
              onClick={() => setTier(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <article className="max-h-48 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        <p className="font-mono text-slate-900">
          {currency} {bundle.pricing.total.toFixed(2)}
        </p>
        {sections?.cover_summary ? (
          <p className="whitespace-pre-wrap text-slate-700">{sections.cover_summary}</p>
        ) : (
          <p className="text-slate-700">{bundle.narrative.summary}</p>
        )}
        {sections?.scope_of_work && (
          <p className="text-xs whitespace-pre-wrap text-slate-600">
            {sections.scope_of_work.slice(0, 400)}
            {sections.scope_of_work.length > 400 ? "…" : ""}
          </p>
        )}
        {documentedAssumptions && documentedAssumptions.length > 0 && (
          <ul className="text-[11px] text-amber-900">
            {documentedAssumptions.map((a) => (
              <li key={a.field}>
                {a.field}: {a.assumed_value}
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <button
          type="button"
          className="rounded-xl bg-slate-900 py-2 text-xs font-medium text-white"
          onClick={() => download("pdf").catch(console.error)}
        >
          PDF (proposal + estimate)
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-300 bg-white py-2 text-xs font-medium"
          onClick={() =>
            api
              .exportUrl(sessionId, tier, "pdf-proposal")
              .then(({ url }) => window.open(url, "_blank"))
              .catch(console.error)
          }
        >
          Proposal PDF
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-300 bg-white py-2 text-xs font-medium"
          onClick={() =>
            api
              .exportUrl(sessionId, tier, "pdf-estimate")
              .then(({ url }) => window.open(url, "_blank"))
              .catch(console.error)
          }
        >
          Estimate PDF
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-300 bg-white py-2 text-xs font-medium"
          onClick={() => download("xlsx").catch(console.error)}
        >
          Download Excel
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-300 bg-white py-2 text-xs font-medium"
          onClick={() => setEditingLines(true)}
        >
          Edit lines
        </button>
        <button
          type="button"
          className="col-span-2 rounded-xl border border-dashed border-slate-300 bg-white py-2 text-xs font-medium"
          onClick={onEditChat}
        >
          Revise in chat
        </button>
        <button
          type="button"
          className="rounded-xl bg-emerald-600 py-2 text-xs font-medium text-white"
          onClick={() => share().catch(console.error)}
        >
          Share link
        </button>
      </div>
    </section>
    </>
  );
}
