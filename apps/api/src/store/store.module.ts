import { Global, Module } from "@nestjs/common";
import { InMemoryStore } from "./in-memory.store";
import { SnapshotRepository } from "./snapshot.repository";

@Global()
@Module({
  providers: [InMemoryStore, SnapshotRepository],
  exports: [InMemoryStore, SnapshotRepository],
})
export class StoreModule {}
