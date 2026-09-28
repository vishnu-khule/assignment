-- MVP PostgreSQL schema (pgvector). Wire with Drizzle/Prisma in week 2.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  locale TEXT NOT NULL DEFAULT 'en-US',
  branding JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proposal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  status TEXT NOT NULL,
  context JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE session_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES proposal_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES proposal_sessions(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT NOT NULL,
  session_id UUID NOT NULL,
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT NOT NULL,
  session_id UUID NOT NULL,
  attachment_id UUID REFERENCES attachments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(1536)
);

CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE proposal_snapshots (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES proposal_sessions(id),
  org_id TEXT NOT NULL,
  version INT NOT NULL,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE share_links (
  token TEXT PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES proposal_snapshots(id),
  org_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'modern',
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE export_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID NOT NULL REFERENCES proposal_snapshots(id),
  org_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  format TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES proposal_sessions(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  step TEXT NOT NULL,
  model TEXT,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  latency_ms INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
