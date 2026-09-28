import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { api, type SharePublicView } from "../lib/api";

const SECTION_LABELS: Record<string, string> = {
  cover_summary: "Summary",
  understanding_of_requirements: "Understanding your requirements",
  scope_of_work: "Scope of work",
  materials_and_specifications: "Materials & specifications",
  timeline: "Timeline",
  price_summary: "Price summary",
  payment_terms: "Payment terms",
  warranty: "Warranty",
  exclusions: "Exclusions",
  assumptions: "Assumptions",
  next_steps: "Next steps",
};

export function SharePage() {
  const { token } = useParams();
  const qc = useQueryClient();
  const [signerName, setSignerName] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["share", token],
    queryFn: () => api.getShare(token!),
    enabled: Boolean(token),
  });

  const actionMutation = useMutation({
    mutationFn: (action: "approve" | "request_changes" | "sign") =>
      api.shareAction(token!, action, {
        tier: data!.tier,
        signer_name: signerName,
        message: action === "request_changes" ? message : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", token] });
    },
  });

  if (isLoading) return <p className="p-6 text-sm">Loading proposal…</p>;
  if (error || !data)
    return <p className="p-6 text-sm text-red-600">Invalid or expired link.</p>;

  const view = data as SharePublicView;
  const sections = view.document_sections;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-1 border-b border-slate-200 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Read-only proposal
        </p>
        <h1 className="text-xl font-semibold">{view.branding?.company_name}</h1>
        <p className="text-sm text-slate-600">
          {view.tier.charAt(0).toUpperCase() + view.tier.slice(1)} option for{" "}
          {view.customer?.name}
        </p>
        <p className="text-sm font-mono">
          Total: {view.currency} {view.pricing.total.toFixed(2)}
        </p>
      </header>

      {view.customer_status && (
        <div className="rounded-xl bg-slate-100 p-3 text-sm">
          <p className="font-medium capitalize">
            Status: {view.customer_status.action.replace("_", " ")}
          </p>
          <p className="text-xs text-slate-600">
            {view.customer_status.signer_name} ·{" "}
            {new Date(view.customer_status.at).toLocaleString()}
          </p>
        </div>
      )}

      {view.documented_assumptions && view.documented_assumptions.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-semibold">Quoted with these assumptions</p>
          <ul className="mt-1 list-disc pl-4">
            {view.documented_assumptions.map((a) => (
              <li key={a.field}>
                {a.field}: {a.assumed_value}
              </li>
            ))}
          </ul>
        </div>
      )}

      <article className="space-y-4 text-sm leading-relaxed text-slate-800">
        {sections
          ? Object.entries(SECTION_LABELS).map(([key, title]) => {
              const body = sections[key as keyof typeof sections];
              if (!body?.trim()) return null;
              return (
                <section key={key}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {title}
                  </h2>
                  <p className="mt-1 whitespace-pre-wrap">{body}</p>
                </section>
              );
            })
          : (
            <>
              <p>{view.narrative.summary}</p>
              <p>{view.narrative.scope}</p>
            </>
          )}
      </article>

      <footer className="space-y-3 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold">Your response</h2>
        <label className="block text-xs text-slate-600">
          Your name
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Full name"
          />
        </label>
        <label className="block text-xs text-slate-600">
          Message (required for request changes)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional unless requesting changes"
          />
        </label>
        {actionMutation.isError && (
          <p className="text-xs text-red-600">
            {(actionMutation.error as Error).message}
          </p>
        )}
        {actionMutation.isSuccess && (
          <p className="text-xs text-green-700">Response recorded. Thank you.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={signerName.length < 2 || actionMutation.isPending}
            className="rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => actionMutation.mutate("approve")}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={
              signerName.length < 2 ||
              message.trim().length < 3 ||
              actionMutation.isPending
            }
            className="rounded-xl border border-slate-300 bg-white py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => actionMutation.mutate("request_changes")}
          >
            Request changes
          </button>
          <button
            type="button"
            disabled={signerName.length < 2 || actionMutation.isPending}
            className="rounded-xl bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => actionMutation.mutate("sign")}
          >
            Sign
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          Your response is stored with a timestamp and IP address for audit purposes.
        </p>
      </footer>
    </div>
  );
}
