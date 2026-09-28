import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const STEP_LABEL: Record<string, string> = {
  intake: "Understand request",
  gap: "Check missing info",
  clarification: "Ask question",
  document_extract: "Read attachment",
  boq: "Build quantities",
  proposal_writer: "Write proposal",
  qa: "Verify proposal",
  export: "Update export",
};

const TOOL_LABEL: Record<string, string> = {
  run_intake: "Tool: intake",
  analyze_gaps: "Tool: gap analysis",
  ask_user: "Tool: reply",
};

type LiveState = {
  step: string | null;
  phase: "start" | "complete" | null;
  tool: string | null;
};

export function AgentActivity({
  sessionId,
  live,
}: {
  sessionId: string | null;
  live?: LiveState;
}) {
  const query = useQuery({
    queryKey: ["agent-runs", sessionId],
    queryFn: () => api.listAgentRuns(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: (q) => {
      const runs = q.state.data?.runs ?? [];
      const last = runs[runs.length - 1];
      if (!last) return 3000;
      if (last.step === "proposal_writer" || last.step === "qa") return 2000;
      return false;
    },
  });

  const runs = query.data?.runs ?? [];
  const showPanel = sessionId && (runs.length > 0 || live?.step || live?.tool);

  if (!showPanel) return null;

  const liveLabel =
    live?.tool && live.phase === "start"
      ? TOOL_LABEL[live.tool] ?? live.tool
      : live?.step && live.phase === "start"
        ? STEP_LABEL[live.step] ?? live.step
        : null;

  return (
    <section
      className="border-b border-indigo-100 bg-gradient-to-b from-indigo-50/90 to-slate-50 px-4 py-3"
      aria-label="AI agent activity"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
          AI agent
        </h2>
        {liveLabel && (
          <span className="flex items-center gap-1.5 text-xs text-indigo-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
            {liveLabel}…
          </span>
        )}
      </div>

      <ol className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-700">
        {runs.map((r) => (
          <li key={r.run_id} className="flex justify-between gap-2">
            <span>
              {STEP_LABEL[r.step] ?? r.step}
              {r.latency_ms > 0 ? ` · ${r.latency_ms}ms` : ""}
            </span>
            <time className="shrink-0 text-slate-500">
              {new Date(r.created_at).toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
