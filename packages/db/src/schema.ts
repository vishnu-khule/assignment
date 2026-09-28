import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  locale: text("locale").notNull().default("en-US"),
  branding: jsonb("branding").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const proposalSessions = pgTable("proposal_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  status: text("status").notNull(),
  context: jsonb("context").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionMessages = pgTable("session_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => proposalSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => proposalSessions.id, { onDelete: "cascade" }),
  orgId: text("org_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  status: text("status").notNull(),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentExtractions = pgTable("document_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  sessionId: uuid("session_id").notNull(),
  attachmentId: uuid("attachment_id")
    .notNull()
    .references(() => attachments.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  sessionId: uuid("session_id").notNull(),
  attachmentId: uuid("attachment_id").references(() => attachments.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
});

export const proposalSnapshots = pgTable("proposal_snapshots", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => proposalSessions.id),
  orgId: text("org_id").notNull(),
  version: integer("version").notNull(),
  contentHash: text("content_hash").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shareLinks = pgTable("share_links", {
  token: text("token").primaryKey(),
  snapshotId: uuid("snapshot_id")
    .notNull()
    .references(() => proposalSnapshots.id),
  orgId: text("org_id").notNull(),
  tier: text("tier").notNull().default("modern"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => proposalSessions.id, { onDelete: "cascade" }),
  orgId: text("org_id").notNull(),
  step: text("step").notNull(),
  model: text("model"),
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerActions = pgTable("customer_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exportArtifacts = pgTable("export_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id").notNull(),
  orgId: text("org_id").notNull(),
  tier: text("tier").notNull(),
  format: text("format").notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
