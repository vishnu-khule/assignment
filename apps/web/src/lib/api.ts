const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as {
        message?: string | { message?: string; hint?: string };
      };
      const m = json.message;
      if (typeof m === "string") throw new Error(m);
      if (m && typeof m === "object") {
        const hint = m.hint ? ` ${m.hint}` : "";
        throw new Error(`${m.message ?? "Request failed"}${hint}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== body) throw e;
    }
    throw new Error(body || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createSession: (body?: { currency?: string; customer_name?: string }) =>
    request<{ id: string; status: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  postMessage: (sessionId: string, content: string) =>
    request<{
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
    }>(`/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  generate: (sessionId: string) =>
    request<{ job_id: string }>(`/proposals/${sessionId}/generate`, {
      method: "POST",
    }),
  options: (sessionId: string) =>
    request<{
      status: string;
      snapshot_id?: string;
      currency?: string;
      branding?: { company_name: string; logo_url?: string };
      documented_assumptions?: {
        field: string;
        assumed_value: string;
        reason: string;
      }[] | null;
      options: {
        basic: ProposalTierOption;
        modern: ProposalTierOption;
        premium: ProposalTierOption;
      } | null;
    }>(`/proposals/${sessionId}/options`),
  listAttachments: (sessionId: string) =>
    request<{
      attachments: {
        id: string;
        filename: string;
        status: AttachmentChipStatus;
      }[];
    }>(`/sessions/${sessionId}/attachments`),
  listExtractions: (sessionId: string) =>
    request<{ extractions: unknown[] }>(`/sessions/${sessionId}/extractions`),
  listAgentRuns: (sessionId: string) =>
    request<{
      runs: {
        run_id: string;
        step: string;
        latency_ms: number;
        created_at: string;
      }[];
    }>(`/sessions/${sessionId}/agent-runs`),
  presign: (session_id: string, filename: string, mime_type: string) =>
    request<{
      attachment_id: string;
      upload_url: string;
      local_dev?: boolean;
    }>("/files/presign", {
      method: "POST",
      body: JSON.stringify({ session_id, filename, mime_type }),
    }),
  uploadLocal: async (attachment_id: string, file: File) => {
    const res = await fetch(
      `${API_BASE}/files/upload/${attachment_id}`,
      {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  completeUpload: (attachment_id: string) =>
    request("/files/complete", {
      method: "POST",
      body: JSON.stringify({ attachment_id }),
    }),
  patchLineItems: (
    sessionId: string,
    tier: string,
    line_items: PricedLineItem[],
  ) =>
    request<{
      tier: string;
      pricing: ProposalTierOption["pricing"];
      options: Record<"basic" | "modern" | "premium", ProposalTierOption>;
    }>(`/proposals/${sessionId}/line-items`, {
      method: "PATCH",
      body: JSON.stringify({ tier, line_items }),
    }),
  exportUrl: (sessionId: string, tier: string, format: string) =>
    request<{ url: string }>(
      `/proposals/${sessionId}/options/${tier}/exports/${format}`,
    ),
  createShare: (snapshot_id: string, tier: string) =>
    request<{ url: string }>("/share", {
      method: "POST",
      body: JSON.stringify({ snapshot_id, tier }),
    }),
  getShare: (token: string) =>
    request<SharePublicView>(`/share/s/${token}`),
  shareAction: (
    token: string,
    action: "approve" | "request_changes" | "sign",
    body: { tier: string; signer_name: string; message?: string },
  ) =>
    request<{ ok: boolean; action: string; recorded_at: string }>(
      `/share/s/${token}/${action === "request_changes" ? "request-changes" : action}`,
      { method: "POST", body: JSON.stringify(body) },
    ),
};

export type AttachmentChipStatus =
  | "pending"
  | "uploaded"
  | "ingesting"
  | "ready"
  | "failed";

export type PricedLineItem = {
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  extended: number;
};

export type ProposalTierOption = {
  pricing: {
    total: number;
    subtotal?: number;
    tax?: number;
    line_items?: PricedLineItem[];
  };
  narrative: { summary: string; scope?: string };
  document_sections?: Record<string, string> | null;
};

export type SharePublicView = {
  tier: "basic" | "modern" | "premium";
  customer: { name: string };
  branding: { company_name: string };
  currency: string;
  read_only: boolean;
  pricing: {
    total: number;
    subtotal: number;
    tax: number;
    valid_until: string;
  };
  document_sections: Record<string, string> | null;
  narrative: { summary: string; scope: string };
  documented_assumptions?: {
    field: string;
    assumed_value: string;
    reason: string;
  }[] | null;
  customer_status: {
    action: string;
    at: string;
    signer_name?: string;
  } | null;
};
