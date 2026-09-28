import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import type {
  ExportJobPayload,
  GenerateJobPayload,
  IngestJobPayload,
} from "@proposal/schemas";

export const QUEUE_INGEST = "ingest";
export const QUEUE_GENERATE = "generate";
export const QUEUE_EXPORT = "export";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private connection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });

  ingestQueue = new Queue<IngestJobPayload>(QUEUE_INGEST, {
    connection: this.connection,
  });
  generateQueue = new Queue<GenerateJobPayload>(QUEUE_GENERATE, {
    connection: this.connection,
  });
  exportQueue = new Queue<ExportJobPayload>(QUEUE_EXPORT, {
    connection: this.connection,
  });

  async onModuleDestroy() {
    await Promise.all([
      this.ingestQueue.close(),
      this.generateQueue.close(),
      this.exportQueue.close(),
      this.connection.quit(),
    ]);
  }
}
