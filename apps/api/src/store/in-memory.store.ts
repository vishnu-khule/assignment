import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  ProposalSnapshot,
  ReferenceDocumentExtraction,
  SessionContext,
} from "@proposal/schemas";

export interface SessionRecord {
  id: string;
  org_id: string;
  status: string;
  context: SessionContext;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AttachmentRecord {
  id: string;
  session_id: string;
  org_id: string;
  filename: string;
  mime_type: string;
  storage_key: string;
  status: "pending" | "uploaded" | "ingesting" | "ready" | "failed";
}

export interface ShareLinkRecord {
  token: string;
  snapshot_id: string;
  org_id: string;
  tier: "basic" | "modern" | "premium";
  expires_at: string;
}

export interface CustomerActionRecord {
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Week-1 placeholder until Drizzle/Postgres wiring lands. */
@Injectable()
export class InMemoryStore {
  sessions = new Map<string, SessionRecord>();
  messages = new Map<string, MessageRecord[]>();
  attachments = new Map<string, AttachmentRecord>();
  snapshots = new Map<string, ProposalSnapshot>();
  shareLinks = new Map<string, ShareLinkRecord>();
  customerActions = new Map<string, CustomerActionRecord[]>();
  agentRuns = new Map<string, import("@proposal/schemas").AgentRun[]>();
  documentExtractions = new Map<string, ReferenceDocumentExtraction[]>();

  createSession(orgId: string, currency = "USD"): SessionRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const context: SessionContext = {
      session_id: id,
      org_id: orgId,
      locale: "en-US",
      currency,
      customer: { name: "Customer" },
      requirements: {},
      gaps: [],
    };
    const record: SessionRecord = {
      id,
      org_id: orgId,
      status: "idle",
      context,
      created_at: now,
      updated_at: now,
    };
    this.sessions.set(id, record);
    this.messages.set(id, []);
    return record;
  }
}
