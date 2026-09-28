import { useState } from "react";
import type { ProposalTierOption } from "../lib/api";

export type LineItem = {
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  extended: number;
};

export function LineItemEditor({
  tier,
  currency,
  bundle,
  onSave,
  onClose,
}: {
  tier: string;
  currency: string;
  bundle: ProposalTierOption;
  onSave: (line_items: LineItem[]) => Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<LineItem[]>(
    bundle.pricing.line_items?.map((li) => ({ ...li })) ?? [],
  );
  const [saving, setSaving] = useState(false);

  function updateRow(index: number, patch: Partial<LineItem>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        next.extended = Number((next.qty * next.unit_price).toFixed(2));
        return next;
      }),
    );
  }

  const total = rows.reduce((s, r) => s + r.extended, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold capitalize">
            Edit line items — {tier}
          </h2>
          <p className="text-xs text-slate-500">
            Totals recalculate in the pricing engine before export.
          </p>
        </header>
        <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-6 gap-1 rounded-lg border border-slate-100 p-2 text-xs"
            >
              <input
                className="col-span-6 rounded border px-2 py-1"
                value={row.description}
                onChange={(e) => updateRow(i, { description: e.target.value })}
              />
              <input
                type="number"
                className="col-span-2 rounded border px-2 py-1"
                value={row.qty}
                min={0}
                step="any"
                onChange={(e) =>
                  updateRow(i, { qty: Number(e.target.value) })
                }
              />
              <input
                className="col-span-2 rounded border px-2 py-1"
                value={row.unit}
                onChange={(e) => updateRow(i, { unit: e.target.value })}
              />
              <input
                type="number"
                className="col-span-2 rounded border px-2 py-1"
                value={row.unit_price}
                min={0}
                step="any"
                onChange={(e) =>
                  updateRow(i, { unit_price: Number(e.target.value) })
                }
              />
              <span className="col-span-6 text-right font-mono text-slate-600">
                {currency} {row.extended.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-sm font-mono">
            {currency} {total.toFixed(2)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-xs"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(rows);
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save &amp; refresh exports
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
