import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SessionsModule } from "./sessions/sessions.module";
import { FilesModule } from "./files/files.module";
import { ProposalsModule } from "./proposals/proposals.module";
import { ShareModule } from "./share/share.module";
import { HealthModule } from "./health/health.module";
import { QueueModule } from "./queue/queue.module";
import { EventsModule } from "./events/events.module";
import { StoreModule } from "./store/store.module";
import { DataModule } from "./data/data.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    StoreModule,
    DataModule,
    QueueModule,
    EventsModule,
    HealthModule,
    SessionsModule,
    FilesModule,
    ProposalsModule,
    ShareModule,
  ],
})
export class AppModule {}
