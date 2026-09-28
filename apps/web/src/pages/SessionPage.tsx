import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttachmentChips, type AttachmentChip } from "../components/AttachmentChips";
import { Composer } from "../components/Composer";
import { MessageList } from "../components/MessageList";
import { MissingInfoCards } from "../components/MissingInfoCards";
import { ProposalResultPanel } from "../components/ProposalResultPanel";
import { AgentActivity } from "../components/AgentActivity";
import { SessionHeader } from "../components/SessionHeader";
import { api } from "../lib/api";
import { postMessageStream } from "../lib/post-message-stream";
import { mapBackendStatus } from "../lib/session-status";
import { useSessionEvents } from "../lib/use-session-events";
import { useStreamingAssistant } from "../lib/use-streaming-assistant";
import { useSessionUi, type UiStatus } from "../store/session-ui";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export function SessionPage() {
  const {
    sessionId,
    setSessionId,
    status,
    setStatus,
    companyName,
    logoUrl,
    setCompanyProfile,
  } = useSessionUi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<
    { field_id: string; question: string }[]
  >([]);
  const [quickReplies, setQuickReplies] = useState<
    { label: string; value: string; field?: string }[]
  >([]);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [attachmentChips, setAttachmentChips] = useState<AttachmentChip[]>([]);
  const [pendingAssistant, setPendingAssistant] = useState<string | null>(null);
  const [shareBanner, setShareBanner] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [agentStreamText, setAgentStreamText] = useState("");
  const [agentStreaming, setAgentStreaming] = useState(false);
  const [agentLive, setAgentLive] = useState<{
    step: string | null;
    phase: "start" | "complete" | null;
    tool: string | null;
  }>({ step: null, phase: null, tool: null });
  const queryClient = useQueryClient();
  const { displayed: streamingText, streaming: isStreaming } =
    useStreamingAssistant(pendingAssistant, () => {
      if (!pendingAssistant) return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: pendingAssistant,
        },
      ]);
      setPendingAssistant(null);
    });

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_BASE ?? "/api/v1"}/health`).then((r) =>
        r.json(),
      ) as Promise<{ llm?: { configured: boolean } }>,
    staleTime: 60_000,
  });
  const llmReady = healthQuery.data?.llm?.configured === true;

  const createSession = useMutation({
    mutationFn: () => api.createSession({ customer_name: "Site Customer" }),
    retry: false,
    onSuccess: (data) => {
      setSessionId(data.id);
      setStatus(mapBackendStatus(data.status));
    },
  });

  // Only re-run when sessionId changes — do not put `createSession` in deps (new object every render → request storm).
  useEffect(() => {
    if (!sessionId) {
      createSession.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const onWsStep = useCallback(
    (next: UiStatus) => setStatus(next),
    [setStatus],
  );
  const onWsAgent = useCallback(
    (payload: { agent_step?: string; agent_tool?: string; phase?: string }) => {
      setAgentLive({
        step: payload.agent_step ?? null,
        phase: (payload.phase as "start" | "complete") ?? null,
        tool: payload.agent_tool ?? null,
      });
      if (payload.phase === "complete") {
        queryClient.invalidateQueries({ queryKey: ["agent-runs", sessionId] });
      }
    },
    [queryClient, sessionId],
  );
  useSessionEvents(sessionId, onWsStep, onWsAgent);

  const attachmentsQuery = useQuery({
    queryKey: ["attachments", sessionId],
    queryFn: () => api.listAttachments(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const server = query.state.data?.attachments ?? [];
      const serverBusy = server.some((a) =>
        a.status === "pending" || a.status === "ingesting",
      );
      const localBusy = attachmentChips.some(
        (c) => c.status === "uploading",
      );
      return serverBusy || localBusy ? 2500 : false;
    },
  });

  const mergedChips = useMemo(() => {
    const server = attachmentsQuery.data?.attachments ?? [];
    const byId = new Map<string, AttachmentChip>();
    for (const chip of attachmentChips) byId.set(chip.id, chip);
    for (const a of server) {
      const chipStatus =
        a.status === "ready"
          ? "ready"
          : a.status === "failed"
            ? "failed"
            : "ingesting";
      byId.set(a.id, {
        id: a.id,
        filename: a.filename,
        status: chipStatus,
        extracted: a.status === "ready",
      });
    }
    return [...byId.values()];
  }, [attachmentChips, attachmentsQuery.data]);

  useEffect(() => {
    const server = attachmentsQuery.data?.attachments ?? [];
    const serverBusy = server.some(
      (a) => a.status === "pending" || a.status === "ingesting",
    );
    const localUploading = attachmentChips.some((c) => c.status === "uploading");
    const localIngesting = mergedChips.some((c) => c.status === "ingesting");

    const locked =
      status === "generating" || status === "review" || status === "shared";
    if (localUploading) {
      if (!locked) setStatus("uploading");
      return;
    }
    if (serverBusy || localIngesting) {
      if (!locked && !readyToGenerate) setStatus("analysing");
      return;
    }
    if (
      !locked &&
      !readyToGenerate &&
      (status === "uploading" || status === "analysing")
    ) {
      setStatus("idle");
    }
  }, [
    attachmentChips,
    attachmentsQuery.data,
    mergedChips,
    readyToGenerate,
    setStatus,
    status,
  ]);

  const showResult =
    status === "generating" ||
    status === "review" ||
    status === "shared";

  const optionsQuery = useQuery({
    queryKey: ["options", sessionId],
    queryFn: async () => {
      const data = await api.options(sessionId!);
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'UI',location:'SessionPage.tsx:optionsQuery',message:'options loaded',data:{hasOptions:!!data.options,snapshotId:data.snapshot_id??null,apiStatus:data.status},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return data;
    },
    enabled: Boolean(sessionId) && showResult,
    refetchInterval: (query) => {
      if (!showResult) return false;
      const hasOpts = Boolean(query.state.data?.options);
      return hasOpts ? false : 1500;
    },
  });

  const attachmentsBusy = mergedChips.some(
    (c) => c.status === "ingesting" || c.status === "uploading",
  );

  const hasProposal = Boolean(
    optionsQuery.data?.options && optionsQuery.data.snapshot_id,
  );
  const proposalPanelRef = useRef<HTMLDivElement | null>(null);
  const autoReviewKey = useRef("");

  useEffect(() => {
    if (optionsQuery.data?.options) {
      setStatus("review");
      setReadyToGenerate(false);
      if (optionsQuery.data.branding?.company_name) {
        setCompanyProfile({
          companyName: optionsQuery.data.branding.company_name,
          logoUrl: optionsQuery.data.branding.logo_url,
        });
      }
    }
  }, [optionsQuery.data, setCompanyProfile, setStatus]);

  useEffect(() => {
    if (hasProposal) {
      proposalPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [hasProposal]);

  const sendMessage = useMutation({
    mutationFn: (content: string) => {
      setSendError(null);
      setAgentStreaming(true);
      setAgentStreamText("");
      if (status !== "review" && status !== "generating") {
        setStatus("analysing");
      }
      return postMessageStream(sessionId!, content, {
        onAgentStep: (step, phase) =>
          setAgentLive({ step, phase, tool: null }),
        onTool: (tool, phase) =>
          setAgentLive({ step: null, phase, tool }),
        onToken: (delta) => setAgentStreamText((t) => t + delta),
      });
    },
    onSuccess: (data) => {
      setAgentStreaming(false);
      setAgentLive({ step: null, phase: null, tool: null });
      const text = data.message?.content ?? agentStreamText;
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'E',location:'SessionPage.tsx:sendSuccess',message:'mutation success',data:{textLen:text?.length??0,fromMessage:!!data.message?.content,questions:data.questions?.length??0,status:data.session?.status},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (text) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: text },
        ]);
      }
      setAgentStreamText("");
      setQuestions(data.questions ?? []);
      setQuickReplies(data.quick_replies ?? []);
      const ready = data.gap_readiness?.ready_to_generate ?? false;
      const assumptions =
        data.session?.context?.requirements?.generate_with_assumptions === true;
      setReadyToGenerate(ready || assumptions);
      if (ready || assumptions) {
        setStatus("review");
      } else {
        setStatus(mapBackendStatus(data.session?.status ?? "asking_questions"));
      }
      queryClient.invalidateQueries({ queryKey: ["agent-runs", sessionId] });
    },
    onError: (err) => {
      const msg =
        err instanceof Error ? err.message : "Could not get a reply. Try again.";
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'D',location:'SessionPage.tsx:sendError',message:'mutation failed',data:{error:msg},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (/session not found/i.test(msg)) {
        autoReviewKey.current = "";
        setSessionId(null);
        setSendError(
          "Session expired after an API restart — starting a fresh session. Re-attach files if needed.",
        );
      } else {
        setSendError(msg);
      }
      setAgentStreaming(false);
      setAgentLive({ step: null, phase: null, tool: null });
      setAgentStreamText("");
    },
  });

  const generate = useMutation({
    mutationFn: () => api.generate(sessionId!),
    onSuccess: () => {
      setStatus("generating");
      setSendError(null);
      queryClient.invalidateQueries({ queryKey: ["options", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["agent-runs", sessionId] });
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'GEN',location:'SessionPage.tsx:generateOk',message:'generate queued',data:{sessionId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    },
    onError: (err) => {
      const msg =
        err instanceof Error ? err.message : "Proposal generation failed.";
      setSendError(msg);
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'GEN',location:'SessionPage.tsx:generateErr',message:'generate failed',data:{error:msg},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    },
  });

  useEffect(() => {
    if (!sessionId || attachmentsBusy || hasProposal) return;
    const total = mergedChips.length;
    const readyCount = mergedChips.filter((c) => c.status === "ready").length;
    if (total === 0 || readyCount < total) return;
    if (mergedChips.some((c) => c.status !== "ready")) return;
    const key = `${sessionId}:all:${total}`;
    if (autoReviewKey.current === key) return;
    if (sendMessage.isPending || agentStreaming || generate.isPending) return;
    autoReviewKey.current = key;
    const prompt =
      `I've uploaded ${readyCount} reference file(s). Review them and ask only what is still missing for scope, site location, access, timeline, and budget — not already covered in the files or chat.`;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: prompt },
    ]);
    sendMessage.mutate(prompt);
  }, [
    sessionId,
    attachmentsBusy,
    mergedChips,
    hasProposal,
    agentStreaming,
    sendMessage,
    generate.isPending,
  ]);

  function sendUserText(text: string) {
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'A',location:'SessionPage.tsx:sendUserText',message:'user send',data:{textLen:text.length,sessionId,chipCount:mergedChips.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const trimmed = text.trim();
    if (/^generate$/i.test(trimmed) && readyToGenerate) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: trimmed },
      ]);
      generate.mutate();
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    sendMessage.mutate(text);
  }

  const showMissingInfo =
    !hasProposal &&
    !attachmentsBusy &&
    (quickReplies.length > 0 || questions.length > 0) &&
    (status === "clarifying" || status === "idle");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-white">
      <SessionHeader
        status={status}
        companyName={companyName}
        logoUrl={logoUrl}
      />

      <AgentActivity sessionId={sessionId} live={agentLive} />

      {attachmentsBusy && readyToGenerate && !hasProposal && (
        <p className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          Still reading your uploads — wait until attachments show ready, then
          Generate so estimates use your files.
        </p>
      )}

      {generate.isPending && (
        <p className="bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-900">
          Starting proposal generation…
        </p>
      )}

      {sendError && (
        <div className="bg-red-50 px-4 py-3 text-xs text-red-950">
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 break-words text-red-900">{sendError}</p>
          {sendError.includes("credits") && (
            <p className="mt-1 text-red-800">
              Add billing at OpenAI or remove <code className="font-mono">OPENAI_API_KEY</code> to use
              offline heuristics only.
            </p>
          )}
        </div>
      )}

      {createSession.isError && (
        <div className="bg-red-50 px-4 py-3 text-xs text-red-950">
          <p className="font-medium">Could not start a session.</p>
          <p className="mt-1 text-red-900">
            Start the API on port{" "}
            <code className="font-mono">3001</code> (
            <code className="font-mono">pnpm dev:api</code> from the repo root),
            then retry.
          </p>
          <button
            type="button"
            className="mt-2 rounded-md bg-red-900 px-3 py-1.5 text-white"
            onClick={() => createSession.mutate()}
          >
            Retry
          </button>
        </div>
      )}

      {!llmReady && healthQuery.isSuccess && (
        <p className="bg-amber-50 px-4 py-2 text-xs text-amber-950">
          Add <code className="font-mono">GEMINI_API_KEY</code> (or{" "}
          <code className="font-mono">OPENAI_API_KEY</code>) to{" "}
          <code className="font-mono">.env</code>, set{" "}
          <code className="font-mono">LLM_PROVIDER=gemini</code>, and restart API
          + worker.
        </p>
      )}

      {shareBanner && (
        <p className="bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
          Share link copied: {shareBanner}
        </p>
      )}

      {status === "generating" && !hasProposal && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          Generating Basic, Modern, and Premium tiers…
        </div>
      )}

      <MessageList
        messages={messages}
        streamingText={
          agentStreaming ? agentStreamText : streamingText
        }
        isStreaming={agentStreaming || isStreaming}
      />

      {showMissingInfo && (
        <MissingInfoCards
          quickReplies={quickReplies}
          questions={questions}
          onSelect={sendUserText}
          showAssumptionsAction={!readyToGenerate}
          onGenerateWithAssumptions={() => sendUserText("generate with assumptions")}
        />
      )}

      <AttachmentChips chips={mergedChips} />

      {hasProposal && optionsQuery.data?.options && optionsQuery.data.snapshot_id && (
        <div ref={proposalPanelRef}>
          <ProposalResultPanel
            sessionId={sessionId!}
            snapshotId={optionsQuery.data.snapshot_id}
            currency={optionsQuery.data.currency ?? "USD"}
            options={optionsQuery.data.options}
            documentedAssumptions={optionsQuery.data.documented_assumptions}
            onEditChat={() => {
              setReadyToGenerate(true);
              setStatus("clarifying");
              sendUserText("I'd like to edit the proposal scope.");
            }}
            onLineItemsSaved={() => optionsQuery.refetch()}
            onShared={(url) => {
              setShareBanner(url);
              setStatus("shared");
            }}
          />
        </div>
      )}

      {optionsQuery.isError && (
        <p className="px-4 py-2 text-xs text-red-800">
          Could not load proposal tiers.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => optionsQuery.refetch()}
          >
            Retry
          </button>
        </p>
      )}

      <Composer
        sessionId={sessionId}
        disabled={
          !sessionId || sendMessage.isPending || isStreaming || agentStreaming
        }
        onSend={sendUserText}
        onGenerate={() => {
          // #region agent log
          fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'GEN',location:'SessionPage.tsx:generateClick',message:'green button',data:{readyToGenerate,status},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          generate.mutate();
        }}
        canGenerate={
          readyToGenerate &&
          !hasProposal &&
          !attachmentsBusy &&
          status !== "generating" &&
          !generate.isPending
        }
        onAttachmentChange={setAttachmentChips}
        onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["attachments", sessionId] });
        }}
      />
    </div>
  );
}
