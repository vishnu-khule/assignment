export type AttachmentChip = {
  id: string;
  filename: string;
  status: "uploading" | "pending" | "ingesting" | "ready" | "failed";
  extracted?: boolean;
};

function label(chip: AttachmentChip) {
  if (chip.status === "uploading") return "Uploading…";
  if (chip.status === "failed") return "Failed";
  if (chip.extracted || chip.status === "ready") return "✓ extracted";
  return "Analysing…";
}

export function AttachmentChips({ chips }: { chips: AttachmentChip[] }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
        >
          <span aria-hidden>📎</span>
          <span className="max-w-[140px] truncate">{chip.filename}</span>
          <span className="text-slate-500">{label(chip)}</span>
        </span>
      ))}
    </div>
  );
}
