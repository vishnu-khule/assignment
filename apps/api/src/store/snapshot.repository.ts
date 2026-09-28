import { Injectable, OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";
import type { ProposalSnapshot } from "@proposal/schemas";
import { ProposalSnapshotSchema } from "@proposal/schemas";

@Injectable()
export class SnapshotRepository implements OnModuleDestroy {
  private redis = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

  async save(snapshot: ProposalSnapshot): Promise<void> {
    const payload = JSON.stringify(snapshot);
    await this.redis.set(`snapshot:session:${snapshot.session_id}`, payload);
    await this.redis.set(`snapshot:id:${snapshot.snapshot_id}`, payload);
  }

  async getBySessionId(sessionId: string): Promise<ProposalSnapshot | null> {
    const raw = await this.redis.get(`snapshot:session:${sessionId}`);
    if (!raw) return null;
    return ProposalSnapshotSchema.parse(JSON.parse(raw));
  }

  async getById(snapshotId: string): Promise<ProposalSnapshot | null> {
    const raw = await this.redis.get(`snapshot:id:${snapshotId}`);
    if (!raw) return null;
    return ProposalSnapshotSchema.parse(JSON.parse(raw));
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
