# AI Proposal & Estimation Generator

Monorepo: **React + NestJS + BullMQ + Postgres (Drizzle) + local/S3 storage**.

**Product roadmap, design rules, and schema/UI/checklist deep dives:** [ROADMAP.md](./ROADMAP.md). Word: `pnpm docs:roadmap` → `docs/ROADMAP.docx`.

## Structure

```
apps/web, api, worker
packages/schemas, pricing-engine, orchestrator, db, storage, ingest, llm, doc-export
```

## Quick start

```bash
cp .env.example .env
docker compose up -d
npx pnpm@9.15.0 install
npx pnpm@9.15.0 db:push
npx pnpm@9.15.0 db:seed
npx pnpm@9.15.0 -r run build

npx pnpm@9.15.0 dev:api
npx pnpm@9.15.0 dev:worker
npx pnpm@9.15.0 dev:web
```

Set `DATABASE_URL` in `.env` for Postgres. Without it, the API falls back to in-memory sessions (workers still need Redis).

Optional: `GEMINI_API_KEY` (Google AI Studio, free tier) or `OPENAI_API_KEY` — set `LLM_PROVIDER=gemini` or `openai`. Enables LLM gap analysis, document ingest, and proposal writing (rule-based fallback otherwise).

Optional: `S3_BUCKET` + credentials for R2/S3; otherwise files land in `LOCAL_STORAGE_PATH`.

## Implemented (week 2)

| Area | Status |
|------|--------|
| Drizzle + Postgres | Sessions, messages, attachments, chunks, snapshots, share links, exports |
| Storage | S3/R2 presigned PUT or local disk + download URL |
| Ingest worker | PDF + Excel text extract, chunk, store in DB |
| Generate worker | LLM scope (optional) + pricing engine snapshot |
| Export worker | PDF (PDFKit), DOCX, XLSX (ExcelJS) |
| LLM | Anthropic gap + scope when API key set |
| Web | File attach (local upload), tier PDF download |

## API routes

See previous table under `/api/v1` — plus `PUT /files/upload/:attachmentId` (local dev) and `GET /files/download?key=`.
