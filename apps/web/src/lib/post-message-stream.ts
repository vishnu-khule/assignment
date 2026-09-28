const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export type StreamHandlers = {
  onAgentStep?: (step: string, phase: "start" | "complete") => void;
  onTool?: (tool: string, phase: "start" | "complete") => void;
  onToken?: (delta: string) => void;
};

export type StreamDonePayload = {
  session: {
    status: string;
    context?: {
      requirements?: { generate_with_assumptions?: boolean };
    };
  };
  message: { content: string };
  questions: { field_id: string; question: string }[];
  quick_replies?: { label: string; value: string; field?: string }[];
  gap_readiness?: { ready_to_generate: boolean };
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.trim().split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  return { event, data };
}

export async function postMessageStream(
  sessionId: string,
  content: string,
  handlers: StreamHandlers,
): Promise<StreamDonePayload> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'C',location:'post-message-stream.ts:http_fail',message:'stream HTTP error',data:{status:res.status,bodyPreview:text.slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error(text || res.statusText);
  }
  // #region agent log
  fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'C',location:'post-message-stream.ts:http_ok',message:'stream opened',data:{sessionId,contentLen:content.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: StreamDonePayload | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const parsed = parseSseBlock(part);
      if (!parsed) continue;
      const json = JSON.parse(parsed.data) as Record<string, unknown>;
      switch (parsed.event) {
        case "agent_step":
          handlers.onAgentStep?.(
            json.step as string,
            json.phase as "start" | "complete",
          );
          break;
        case "tool":
          handlers.onTool?.(
            json.tool as string,
            json.phase as "start" | "complete",
          );
          break;
        case "token":
          handlers.onToken?.(json.delta as string);
          break;
        case "done":
          donePayload = json as StreamDonePayload;
          // #region agent log
          fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'E',location:'post-message-stream.ts:done',message:'stream done event',data:{hasMessage:!!(json as StreamDonePayload).message,contentLen:typeof (json as StreamDonePayload).message?.content==='string'?(json as StreamDonePayload).message.content.length:0,sessionStatus:(json as StreamDonePayload).session?.status},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          break;
        case "error":
          // #region agent log
          fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'D',location:'post-message-stream.ts:sse_error',message:'stream error event',data:{msg:json.message},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          throw new Error((json.message as string) ?? "Stream failed");
        default:
          break;
      }
    }
  }

  if (!donePayload) {
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'C',location:'post-message-stream.ts:no_done',message:'stream ended without done',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error("Stream ended without result");
  }
  return donePayload;
}
