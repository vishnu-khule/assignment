import { STATUS_LABELS } from "../lib/session-status";
import type { UiStatus } from "../store/session-ui";

export function SessionHeader({
  status,
  companyName,
  logoUrl,
}: {
  status: UiStatus;
  companyName: string;
  logoUrl?: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white"
              aria-hidden
            >
              {companyName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {companyName}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              AI proposal &amp; estimates
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
          {STATUS_LABELS[status]}
        </span>
      </div>
    </header>
  );
}
