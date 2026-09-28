import type { QuickReply } from "./MessageList";

export function MissingInfoCards({
  quickReplies,
  questions,
  onSelect,
  onGenerateWithAssumptions,
  showAssumptionsAction,
}: {
  quickReplies: QuickReply[];
  questions: { field_id: string; question: string }[];
  onSelect: (value: string) => void;
  onGenerateWithAssumptions?: () => void;
  showAssumptionsAction?: boolean;
}) {
  const cards = quickReplies.length
    ? quickReplies
    : questions.map((q) => ({
        label: q.question,
        value: q.question,
        field: q.field_id,
      }));

  if (!cards.length && !showAssumptionsAction) return null;

  return (
    <div className="space-y-2 px-4 pb-2">
      {cards.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
          <p className="text-xs font-semibold text-amber-950">
            Details we still need
          </p>
          <p className="mt-0.5 text-[11px] text-amber-900/80">
            From your uploads and chat — answer in the box below or tap a quick
            reply
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {cards.map((q, i) => (
              <button
                key={`${q.field ?? "q"}-${i}`}
                type="button"
                className="rounded-lg bg-white px-3 py-2 text-left text-xs font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80"
                onClick={() => onSelect(q.value)}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {showAssumptionsAction && onGenerateWithAssumptions && (
        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-slate-300 bg-white py-2 text-xs font-medium text-slate-600"
          onClick={onGenerateWithAssumptions}
        >
          Generate with documented assumptions
        </button>
      )}
    </div>
  );
}
