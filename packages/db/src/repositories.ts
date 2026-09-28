import { and, desc, eq } from "drizzle-orm";
import type { ProposalSnapshot, SessionContext } from "@proposal/schemas";
import { ProposalSnapshotSchema, SessionContextSchema } from "@proposal/schemas";
import { getDb } from "./client.js";
import {
  attachments,
  customerActions,
  documentChunks,
  documentExtractions,
  exportArtifacts,
  organizations,
  proposalSessions,
  proposalSnapshots,
  sessionMessages,
  shareLinks,
  agentRuns,
} from "./schema.js";
import type { AgentRun } from "@proposal/schemas";

export async function ensureOrganization(orgId: string, name: string) {
  const db = getDb();
  await db
    .insert(organizations)
    .values({ id: orgId, name, branding: { company_name: name } })
    .onConflictDoNothing();
}

export async function createSession(orgId: string, currency: string) {
  const db = getDb();
  await ensureOrganization(orgId, process.env.DEFAULT_COMPANY_NAME ?? orgId);
  const context: SessionContext = SessionContextSchema.parse({
    session_id: "00000000-0000-4000-8000-000000000000",
    org_id: orgId,
    locale: "en-US",
    currency,
    customer: { name: "Customer" },
    requirements: {},
    gaps: [],
  });
  const [row] = await db
    .insert(proposalSessions)
    .values({ orgId, status: "idle", context })
    .returning();
  const sessionId = row.id;
  const fullContext = { ...context, session_id: sessionId };
  await db
    .update(proposalSessions)
    .set({ context: fullContext })
    .where(eq(proposalSessions.id, sessionId));
  return { ...row, context: fullContext };
}

export async function listSessions(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(proposalSessions)
    .where(eq(proposalSessions.orgId, orgId))
    .orderBy(desc(proposalSessions.updatedAt));
}

export async function getSessionById(sessionId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(proposalSessions)
    .where(eq(proposalSessions.id, sessionId));
  return row ?? null;
}

export async function getSession(orgId: string, sessionId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(proposalSessions)
    .where(
      and(eq(proposalSessions.id, sessionId), eq(proposalSessions.orgId, orgId)),
    );
  return row ?? null;
}

export async function updateSession(
  sessionId: string,
  patch: { status?: string; context?: SessionContext },
) {
  const db = getDb();
  const [row] = await db
    .update(proposalSessions)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.context ? { context: patch.context } : {}),
      updatedAt: new Date(),
    })
    .where(eq(proposalSessions.id, sessionId))
    .returning();
  return row ?? null;
}

export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
) {
  const db = getDb();
  const [row] = await db
    .insert(sessionMessages)
    .values({ sessionId, role, content })
    .returning();
  return row;
}

export async function listMessages(sessionId: string) {
  const db = getDb();
  return db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, sessionId))
    .orderBy(sessionMessages.createdAt);
}

export async function createAttachment(input: {
  id: string;
  sessionId: string;
  orgId: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  status: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(attachments)
    .values({
      id: input.id,
      sessionId: input.sessionId,
      orgId: input.orgId,
      filename: input.filename,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      status: input.status,
    })
    .returning();
  return row;
}

export async function listAttachmentsForSession(sessionId: string) {
  const db = getDb();
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.sessionId, sessionId));
}

export async function getAttachment(id: string) {
  const db = getDb();
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
  return row ?? null;
}

export async function updateAttachment(
  id: string,
  patch: { status?: string; extractedText?: string },
) {
  const db = getDb();
  const [row] = await db
    .update(attachments)
    .set(patch)
    .where(eq(attachments.id, id))
    .returning();
  return row ?? null;
}

export async function saveDocumentExtraction(input: {
  orgId: string;
  sessionId: string;
  attachmentId: string;
  payload: unknown;
}) {
  const db = getDb();
  const [row] = await db
    .insert(documentExtractions)
    .values({
      orgId: input.orgId,
      sessionId: input.sessionId,
      attachmentId: input.attachmentId,
      payload: input.payload,
    })
    .returning();
  return row;
}

export async function listDocumentExtractionsForSession(sessionId: string) {
  const db = getDb();
  return db
    .select()
    .from(documentExtractions)
    .where(eq(documentExtractions.sessionId, sessionId));
}

export async function listChunksForSession(sessionId: string, limit = 12) {
  const db = getDb();
  return db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.sessionId, sessionId))
    .limit(limit);
}

export async function insertChunks(
  rows: {
    orgId: string;
    sessionId: string;
    attachmentId: string;
    content: string;
    metadata: Record<string, unknown>;
  }[],
) {
  if (rows.length === 0) return;
  const db = getDb();
  await db.insert(documentChunks).values(rows);
}

export async function saveSnapshot(snapshot: ProposalSnapshot) {
  const validated = ProposalSnapshotSchema.parse(snapshot);
  const db = getDb();
  await db.insert(proposalSnapshots).values({
    id: validated.snapshot_id,
    sessionId: validated.session_id,
    orgId: validated.org_id,
    version: validated.version,
    contentHash: validated.content_hash,
    payload: validated,
  });
  await updateSession(validated.session_id, { status: "review" });
  return validated;
}

export async function getSnapshotBySession(sessionId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(proposalSnapshots)
    .where(eq(proposalSnapshots.sessionId, sessionId))
    .orderBy(desc(proposalSnapshots.version))
    .limit(1);
  if (!row) return null;
  return ProposalSnapshotSchema.parse(row.payload);
}

export async function getSnapshotById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(proposalSnapshots)
    .where(eq(proposalSnapshots.id, id));
  if (!row) return null;
  return ProposalSnapshotSchema.parse(row.payload);
}

export async function updateSnapshotPayload(snapshot: ProposalSnapshot) {
  const validated = ProposalSnapshotSchema.parse(snapshot);
  const db = getDb();
  await db
    .update(proposalSnapshots)
    .set({
      payload: validated,
      contentHash: validated.content_hash,
      version: validated.version,
    })
    .where(eq(proposalSnapshots.id, validated.snapshot_id));
  return validated;
}

export async function insertAgentRun(run: AgentRun) {
  const db = getDb();
  await db.insert(agentRuns).values({
    id: run.run_id,
    sessionId: run.session_id,
    orgId: run.org_id,
    step: run.step,
    model: run.model,
    input: run.input,
    output: run.output,
    latencyMs: run.latency_ms,
    createdAt: new Date(run.created_at),
  });
}

export async function listAgentRunsForSession(sessionId: string) {
  const db = getDb();
  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.sessionId, sessionId))
    .orderBy(desc(agentRuns.createdAt));
}

export async function createShareLink(input: {
  token: string;
  snapshotId: string;
  orgId: string;
  tier: string;
  expiresAt: Date;
}) {
  const db = getDb();
  await db.insert(shareLinks).values({
    token: input.token,
    snapshotId: input.snapshotId,
    orgId: input.orgId,
    tier: input.tier,
    expiresAt: input.expiresAt,
  });
}

export async function getShareLink(token: string) {
  const db = getDb();
  const [row] = await db.select().from(shareLinks).where(eq(shareLinks.token, token));
  return row ?? null;
}

export async function recordCustomerAction(
  token: string,
  action: string,
  payload: Record<string, unknown>,
) {
  const db = getDb();
  await db.insert(customerActions).values({ token, action, payload });
}

export async function getCustomerActionsByToken(token: string) {
  const db = getDb();
  return db
    .select()
    .from(customerActions)
    .where(eq(customerActions.token, token))
    .orderBy(desc(customerActions.createdAt));
}

export async function saveExportArtifact(input: {
  snapshotId: string;
  orgId: string;
  tier: string;
  format: string;
  storageKey: string;
}) {
  const db = getDb();
  await db.insert(exportArtifacts).values(input);
}

export async function getExportArtifact(
  snapshotId: string,
  tier: string,
  format: string,
) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(exportArtifacts)
    .where(
      and(
        eq(exportArtifacts.snapshotId, snapshotId),
        eq(exportArtifacts.tier, tier),
        eq(exportArtifacts.format, format),
      ),
    )
    .orderBy(desc(exportArtifacts.createdAt))
    .limit(1);
  return row ?? null;
}
