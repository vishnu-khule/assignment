import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import {
  appendAgentRunRedis,
  runProposalGenerate,
} from "@proposal/orchestrator";
import {
  closeDb,
  getSnapshotById,
  insertChunks,
  isDbConfigured,
  listChunksForSession,
  saveDocumentExtraction,
  saveExportArtifact,
  saveSnapshot,
  updateAttachment,
} from "@proposal/db";
import { chunkText, extractText, imageMediaType, isImageMime } from "@proposal/ingest";
import { extractReferenceDocument, isLlmConfigured } from "@proposal/llm";

const rootEnv = resolve(process.cwd(), "../../.env");
const localEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) loadEnv({ path: rootEnv });
else if (existsSync(localEnv)) loadEnv({ path: localEnv });
import { mergeExtractionIntoSession } from "./merge-extraction.js";
import {
  ExportJobPayloadSchema,
  GenerateJobPayloadSchema,
  IngestJobPayloadSchema,
  redisKeys,
  SessionContextSchema,
} from "@proposal/schemas";
import { getObject, putObject, publicUrl } from "@proposal/storage";
import {
  renderDocx,
  renderPdf,
  renderPdfEstimate,
  renderPdfProposal,
  renderXlsx,
} from "@proposal/doc-export";
const connection = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

const tiers = ["basic", "modern", "premium"] as const;

new Worker(
  "ingest",
  async (job) => {
    const data = IngestJobPayloadSchema.parse(job.data);
    console.log("[ingest]", data.attachment_id, data.mime_type);

    try {
    const buffer = await getObject(data.storage_key);
    const text = await extractText(buffer, data.mime_type);
    const chunks = chunkText(text);

    const imageType = isImageMime(data.mime_type)
      ? imageMediaType(data.mime_type)
      : null;
    if (!isLlmConfigured()) {
      console.warn(
        "[ingest] No LLM API key (GEMINI_API_KEY or OPENAI_API_KEY) — document analysis uses heuristics only",
      );
    }

    const extractStarted = Date.now();
    let extraction = await extractReferenceDocument({
      filename: data.filename,
      mimeType: data.mime_type,
      textContent: text,
      imageBase64: imageType ? buffer.toString("base64") : undefined,
      imageMediaType: imageType ?? undefined,
    });
    if (
      (extraction.line_items?.length ?? 0) < 2 &&
      (data.mime_type.includes("sheet") ||
        data.filename.toLowerCase().endsWith(".xlsx"))
    ) {
      const { extractDocumentHeuristic } = await import("@proposal/llm");
      const sheet = extractDocumentHeuristic({
        filename: data.filename,
        mimeType: data.mime_type,
        textContent: text,
      });
      if ((sheet.line_items?.length ?? 0) >= (extraction.line_items?.length ?? 0)) {
        extraction = sheet;
      } else if (sheet.scope_of_work?.length) {
        extraction = { ...extraction, scope_of_work: sheet.scope_of_work, dimensions: sheet.dimensions ?? extraction.dimensions };
      }
    }
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    await appendAgentRunRedis(redisUrl, {
      session_id: data.session_id,
      org_id: data.org_id,
      step: "document_extract",
      input: { filename: data.filename, mime_type: data.mime_type },
      output: {
        document_type: extraction.document_type,
        line_items: extraction.line_items?.length ?? 0,
      },
      latency_ms: Date.now() - extractStarted,
    });

    if (isDbConfigured()) {
      await saveDocumentExtraction({
        orgId: data.org_id,
        sessionId: data.session_id,
        attachmentId: data.attachment_id,
        payload: extraction,
      });
      await mergeExtractionIntoSession(data.session_id, extraction);
    } else {
      const key = redisKeys.extractions(data.session_id);
      const existing = JSON.parse((await connection.get(key)) ?? "[]");
      existing.push(extraction);
      await connection.set(key, JSON.stringify(existing), "EX", 604800);

      const chunkKey = redisKeys.chunks(data.session_id);
      const prevChunks = JSON.parse((await connection.get(chunkKey)) ?? "[]");
      await connection.set(
        chunkKey,
        JSON.stringify([...prevChunks, ...chunks]),
        "EX",
        604800,
      );

      await connection.hset(
        redisKeys.attachmentStatusHash(data.session_id),
        data.attachment_id,
        "ready",
      );
    }

    if (isDbConfigured()) {
      await updateAttachment(data.attachment_id, {
        status: "ready",
        extractedText: text.slice(0, 50_000),
      });
      await insertChunks(
        chunks.map((content, index) => ({
          orgId: data.org_id,
          sessionId: data.session_id,
          attachmentId: data.attachment_id,
          content,
          metadata: { index, mime_type: data.mime_type },
        })),
      );
    }

    await connection.publish(
      "session.events",
      JSON.stringify({
        session_id: data.session_id,
        step: "asking_questions",
        message: chunks.length
          ? `Indexed ${chunks.length} text chunks from file`
          : "File stored (no extractable text)",
      }),
    );

    return { status: "ready", chunks: chunks.length };
    } catch (err) {
      console.error("[ingest] failed", data.attachment_id, err);
      await connection.hset(
        redisKeys.attachmentStatusHash(data.session_id),
        data.attachment_id,
        "failed",
      );
      throw err;
    }
  },
  { connection },
);

new Worker(
  "generate",
  async (job) => {
    const data = GenerateJobPayloadSchema.parse(job.data);
    console.log("[generate]", data.session_id);
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'WORKER',location:'worker/main.ts:generateStart',message:'generate job started',data:{sessionId:data.session_id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    let context = SessionContextSchema.parse(data.context);
    let snippets = isDbConfigured()
      ? (await listChunksForSession(data.session_id)).map((c) => c.content)
      : [];

    if (!isDbConfigured()) {
      const extRaw = await connection.get(redisKeys.extractions(data.session_id));
      if (extRaw) {
        const extractions = JSON.parse(extRaw);
        context = {
          ...context,
          requirements: {
            ...context.requirements,
            reference_extractions: extractions,
          },
        };
      }
      const chunkRaw = await connection.get(redisKeys.chunks(data.session_id));
      if (chunkRaw) {
        snippets = JSON.parse(chunkRaw) as string[];
      }
    }

    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    const { snapshot } = await runProposalGenerate({
      session_id: data.session_id,
      org_id: data.org_id,
      context,
      companyName: process.env.DEFAULT_COMPANY_NAME ?? "Your Company",
      ragSnippets: snippets,
      onStep: async (record) => {
        await appendAgentRunRedis(redisUrl, {
          session_id: data.session_id,
          org_id: data.org_id,
          step: record.step,
          model: record.model,
          input: record.input,
          output: record.output,
          latency_ms: record.latency_ms,
        });
      },
    });

    if (isDbConfigured()) {
      await saveSnapshot(snapshot);
    } else {
      const payload = JSON.stringify(snapshot);
      await connection.set(`snapshot:session:${snapshot.session_id}`, payload);
      await connection.set(`snapshot:id:${snapshot.snapshot_id}`, payload);
    }

    await connection.publish(
      "session.events",
      JSON.stringify({
        session_id: data.session_id,
        step: "review",
        snapshot_id: snapshot.snapshot_id,
      }),
    );

    const exportQueue = new Queue("export", { connection });
    await exportQueue.add("export", {
      snapshot_id: snapshot.snapshot_id,
      org_id: data.org_id,
      formats: ["pdf", "pdf-proposal", "pdf-estimate", "docx", "xlsx"],
    });
    await exportQueue.close();

    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'WORKER',location:'worker/main.ts:generateDone',message:'generate job done',data:{sessionId:data.session_id,snapshotId:snapshot.snapshot_id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { snapshot_id: snapshot.snapshot_id };
  },
  { connection },
);

new Worker(
  "export",
  async (job) => {
    const data = ExportJobPayloadSchema.parse(job.data);
    console.log("[export]", data.snapshot_id, data.formats.join(","));

    let snapshot =
      isDbConfigured() ? await getSnapshotById(data.snapshot_id) : null;
    if (!snapshot) {
      const raw = await connection.get(`snapshot:id:${data.snapshot_id}`);
      if (raw) snapshot = JSON.parse(raw);
    }
    if (!snapshot) throw new Error("Snapshot not found for export");

    for (const tier of tiers) {
      for (const format of data.formats) {
        let body: Buffer;
        if (format === "pdf") body = await renderPdf(snapshot, tier);
        else if (format === "pdf-proposal")
          body = await renderPdfProposal(snapshot, tier);
        else if (format === "pdf-estimate")
          body = await renderPdfEstimate(snapshot, tier);
        else if (format === "xlsx") body = await renderXlsx(snapshot, tier);
        else if (format === "docx") body = await renderDocx(snapshot, tier);
        else continue;

        const fileName =
          format === "pdf-proposal"
            ? `${tier}.proposal.pdf`
            : format === "pdf-estimate"
              ? `${tier}.estimate.pdf`
              : `${tier}.${format}`;
        const storageKey = `${data.org_id}/exports/${data.snapshot_id}/${fileName}`;
        const mime =
          format === "pdf" ||
          format === "pdf-proposal" ||
          format === "pdf-estimate"
            ? "application/pdf"
            : format === "xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        await putObject(storageKey, body, mime);

        if (isDbConfigured()) {
          await saveExportArtifact({
            snapshotId: data.snapshot_id,
            orgId: data.org_id,
            tier,
            format,
            storageKey,
          });
        } else {
          await connection.set(
            `export:${data.snapshot_id}:${tier}:${format}`,
            storageKey,
            "EX",
            604800,
          );
        }
        console.log("[export] wrote", publicUrl(storageKey));
      }
    }

    return { ok: true };
  },
  { connection },
);

console.log("Workers running: ingest, generate, export");

process.on("SIGTERM", async () => {
  await closeDb();
  process.exit(0);
});
