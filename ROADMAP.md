# Product roadmap & implementation guide

## Phases

| Phase | Scope | Time | Goal |
|-------|--------|------|------|
| **MVP** | Chat input, file upload, extraction, gap questions, 3-tier PDF, download | 6–8 weeks | End-to-end quote a job without spreadsheets |
| **V1** | Rate card library, company branding, share link with approve/e-sign, edit before export | +4–6 weeks | Contractor-ready workflow and customer sign-off |
| **V2** | Learning from past proposals (RAG), multi-language, WhatsApp/email sending, payments, analytics | +6–8 weeks | Scale, channels, and continuous improvement |

---

## Key design rules

| Rule | Meaning |
|------|---------|
| **LLM reads, questions, writes; code does math** | Models structure narrative and intake; `pricing-engine` and BOQ paths own totals, tax, and tier multipliers. |
| **Every number traces to a source** | File extraction, user answer, reference rate, or **flagged assumption** (documented in snapshot and exports). |
| **Users can edit any line item before export** | Mutable scope/BOQ/pricing on the snapshot, then re-render PDF/DOCX/XLSX from JSON. |
| **Log all agent inputs and outputs** | Persist prompts, structured LLM JSON, and deterministic outputs per step for eval and debugging. |

These rules are non-negotiable for production; gaps below call out where the repo still needs work.

---

## Built vs next (by phase)

### MVP

| Capability | Status | Location / notes |
|------------|--------|------------------|
| Chat + session context | Done | `apps/api` sessions, `apps/web` `SessionPage` |
| File upload + ingest | Done | `files` API, `apps/worker` ingest queue, `packages/ingest` |
| Reference extraction | Done | `document-extract`, `document_extractions`, merged into requirements |
| Gap / clarification | Done | `gap-readiness`, `clarification`, `MissingInfoCards` |
| Generate 3 tiers | Done | `buildProposalSnapshot`, worker `generate` |
| PDF / DOCX / XLSX | Done | `packages/doc-export` (template-only, no LLM) |
| Download from UI | Done | `ProposalResultPanel` → export URLs |
| Proposal QA (deterministic) | Done | `proposal-verifier`, Step 6 retry loop |
| UI state machine | Done | `session-ui.ts`, `session-status.ts` |
| **Line-item edit before export** | Done | `LineItemEditor` + `PATCH /proposals/:id/line-items`, re-export queue |
| **Full number provenance in UI** | Partial | BOQ `unit_cost_source`, assumptions in snapshot; not all surfaced in web |
| **Agent I/O eval log** | Done (core) | `agent_runs` table + intake/gap logging; `GET /sessions/:id/agent-runs` |

### V1

| Capability | Status | Location / notes |
|------------|--------|------------------|
| Reference rates (seed) | Done | `reference-rates.ts`, `default-reference-rates` |
| **Org rate card library (CRUD UI)** | Missing | Needs API + web settings |
| Company branding on snapshot | Done | `branding` on `ProposalSnapshot`, header from options |
| Share link (tier-scoped) | Done | `share_links`, `POST /share` |
| Approve / request changes / sign | Done | `customer_actions`, `SharePage`, IP + timestamp audit |
| **Rich edit before export** | Missing | Re-generate snapshot after line edits |
| Share status on contractor dashboard | Missing | List actions per session |

### V2

| Capability | Status | Notes |
|------------|--------|--------|
| RAG from past proposals | Stub | `document_chunks`, pgvector schema; no retrieval loop in generate |
| Multi-language | Stub | `locale` on context; copy not localized |
| WhatsApp / email send | Missing | — |
| Payments (deposit) | Missing | — |
| Analytics | Missing | — |

---

## Deep dive: JSON schemas (`packages/schemas`)

All cross-service contracts are **Zod** schemas compiled to TypeScript types. Import from `@proposal/schemas`.

### Module map

| File | Purpose |
|------|---------|
| `session.ts` | `SessionContext`, `SessionStatus`, gaps, readiness |
| `intake.ts` | LLM intake structured result → context patch |
| `document-extraction.ts` | Parsed fields from uploaded PDFs/spreadsheets |
| `trade-checklist.ts` | Static required fields per trade (see below) |
| `gap-readiness.ts` | `ready_to_generate`, prioritized `missing[]` |
| `clarification.ts` | Quick replies, `DocumentedAssumption` |
| `scope.ts` | `ScopePlan`, line items for pricing |
| `boq.ts` | Bill of quantities lines + `flagged_assumptions` |
| `reference-rates.ts` | SKU / unit costs for BOQ planner |
| `pricing.ts` | `TierPricing`, line item totals |
| `tier.ts` | `basic` \| `modern` \| `premium` |
| `proposal-document.ts` | Customer-facing section text (11 keys) |
| `proposal-snapshot.ts` | Immutable publishable bundle per session version |
| `proposal-qa.ts` | `{ passed, issues[] }` verification result |
| `customer-action.ts` | Share link approve / sign / request-changes payload |
| `jobs.ts` | BullMQ payloads: ingest, generate, export |

### Data flow (happy path)

```text
SessionContext (requirements, gaps)
    → IntakeResult + GapReadinessResult
    → ScopePlan + BillOfQuantities (optional)
    → pricing-engine → TierPricing × 3
    → ProposalDocumentSections × 3 (LLM or heuristic)
    → ProposalSnapshot (+ qa_verification)
    → doc-export / share public view
```

**Source of truth for money:** `ProposalSnapshot.tiers[tier].pricing` and BOQ items. Narrative `price_summary` must match (enforced by `verifyTierProposal`).

### Extending schemas

1. Add field to `SessionContext.requirements` or trade checklist `field` id.
2. Map intake / gap analyzer to fill it.
3. If it affects quantity or rate, thread into BOQ or `ScopePlan.line_items`.
4. Bump snapshot `version` or `content_hash` when regenerating.

---

## Deep dive: React UI (`apps/web`)

### Routes

| Path | Component | Role |
|------|-----------|------|
| `/` | `SessionPage` | Contractor workflow |
| `/s/:token` | `SharePage` | Public read-only proposal + customer actions |

### Session layout (contractor)

```text
SessionHeader (logo, company, status pill)
  → ProposalResultPanel (when generating / review / shared)
      Tabs: Basic | Modern | Premium
      Actions: PDF, Excel, Edit (chat), Share link
  → MessageList (streaming assistant)
  → MissingInfoCards (gap quick replies)
  → AttachmentChips (uploading → analysing → ✓ extracted)
  → Composer (text, 📎 attach, 🎤 placeholder)
```

### UI state machine

`idle → uploading → analysing → clarifying → generating → review → shared`

Mapped from API status in `lib/session-status.ts` (`asking_questions` → `clarifying`).

State: **Zustand** `store/session-ui.ts`. Server state: **TanStack Query** (`options`, `attachments`, `share`).

### Key files

| File | Responsibility |
|------|----------------|
| `lib/api.ts` | REST client, types for options/share |
| `lib/use-streaming-assistant.ts` | Chunked reveal of assistant text |
| `lib/use-session-events.ts` | Optional WebSocket `session.event` |
| `components/ProposalResultPanel.tsx` | Tier tabs, exports, share |
| `pages/SharePage.tsx` | Customer document sections + audit actions |

### MVP UI gaps (roadmap)

- **Line-item editor:** modal or sheet bound to `bill_of_quantities` / `pricing.line_items`, PATCH snapshot, re-queue export only.
- **Provenance chips:** per line show `reference` \| `user` \| `assumption` from BOQ.
- **Rate library:** settings page writing `reference_rates` org table (V1).

---

## Deep dive: Trade-specific checklists

Defined in `packages/schemas/src/trade-checklist.ts`. Consumed by gap readiness (`getTradeChecklist(trade)`).

### Trades today

| Trade | Extra fields beyond `BASE` |
|-------|----------------------------|
| `general` | Base only |
| `plumbing` | `water_shutoff` (optional) |
| `electrical` | `panel_capacity` (required) |
| `hvac` | `system_type` repair vs replace (required) |

### Base fields (all trades)

`work_summary`, `site_address`, `area_sqm`, `material_grade`, `site_access`, `deadline`, optional `budget_range` — each with `priority` 1–5 for question ordering.

### Adding a trade (e.g. furniture maker)

1. Extend `TradeSchema` in `session.ts` and `TradeKey` in `trade-checklist.ts`.
2. Add `BY_TRADE.furniture_maker` entries, for example:
   - `piece_count` / `dimensions` (required, priority 1)
   - `wood_species` or `board_material` (required, priority 1)
   - `finish_level` — paint/stain/lacquer (required, priority 2)
   - `hardware_grade` (optional)
   - `delivery_install` — shop vs on-site (required, priority 2)
3. Seed `reference-rates` SKUs for lumber, hardware, shop labour hours.
4. Optional: trade-specific BOQ planner hints in `packages/llm` BOQ prompt.
5. Set `context.trade` from intake or session create.

Gap analyzer merges checklist with `context.requirements` and extraction; missing required fields become `MissingInfoCards` in the UI.

---

## Agent logging (design rule follow-up)

**Target shape (recommended):**

```typescript
// packages/schemas/src/agent-run.ts (future)
{
  run_id, session_id, step: "intake" | "gap" | "boq" | "proposal_writer" | "qa",
  model?: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  latency_ms, created_at
}
```

Persist in Postgres `agent_runs` or append-only object storage. Wire in `packages/llm` wrappers and worker generate path. Enables regression evals without replaying production chat.

---

## Related docs

- [README.md](./README.md) — quick start and stack
- [infra/db/schema.sql](./infra/db/schema.sql) — SQL reference

### Word export

```bash
pnpm install
pnpm docs:roadmap
```

Output: `docs/ROADMAP.docx`
