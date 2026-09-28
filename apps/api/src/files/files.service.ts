import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { presignUpload, putObject, publicUrl } from "@proposal/storage";
import { DataAccessService } from "../data/data-access.service";
import { QueueService } from "../queue/queue.service";
import { EventsGateway } from "../events/events.gateway";
import type { PresignUploadDto } from "./files.dto";

@Injectable()
export class FilesService {
  constructor(
    private readonly data: DataAccessService,
    private readonly queues: QueueService,
    private readonly events: EventsGateway,
  ) {}

  async presign(orgId: string, dto: PresignUploadDto) {
    const session = await this.data.getSession(orgId, dto.session_id);
    if (!session) throw new NotFoundException("Session not found");

    const attachmentId = randomUUID();
    const storageKey = `${orgId}/${dto.session_id}/${attachmentId}/${dto.filename}`;

    await this.data.createAttachment({
      id: attachmentId,
      session_id: dto.session_id,
      org_id: orgId,
      filename: dto.filename,
      mime_type: dto.mime_type,
      storage_key: storageKey,
      status: "pending",
    });

    await this.data.updateSession(dto.session_id, { status: "uploading" });

    const apiBase = process.env.API_PUBLIC_URL ?? "http://localhost:3000/api/v1";
    const presigned = await presignUpload(storageKey, dto.mime_type, apiBase);

    return {
      attachment_id: attachmentId,
      upload_url: presigned.uploadUrl,
      storage_key: storageKey,
      expires_in: 900,
      method: presigned.method,
      local_dev: presigned.localDev ?? false,
    };
  }

  async uploadLocal(
    orgId: string,
    attachmentId: string,
    buffer: Buffer,
    mimeType: string,
  ) {
    const attachment = await this.data.getAttachment(attachmentId);
    if (!attachment) throw new NotFoundException("Attachment not found");
    if (attachment.org_id !== orgId) throw new ForbiddenException();

    await putObject(attachment.storage_key, buffer, mimeType);
    return this.complete(orgId, { attachment_id: attachmentId });
  }

  getDownloadUrl(storageKey: string) {
    return { url: publicUrl(storageKey) };
  }

  async complete(orgId: string, dto: { attachment_id: string }) {
    const attachment = await this.data.getAttachment(dto.attachment_id);
    if (!attachment) throw new NotFoundException("Attachment not found");
    if (attachment.org_id !== orgId) throw new ForbiddenException();

    await this.data.updateAttachment(dto.attachment_id, { status: "ingesting" });
    await this.data.updateSession(attachment.session_id, { status: "analysing" });

    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'B',location:'files.service.ts:ingest_queued',message:'ingest job queued',data:{attachmentId:attachment.id,sessionId:attachment.session_id,mime:attachment.mime_type},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await this.queues.ingestQueue.add("ingest", {
      attachment_id: attachment.id,
      session_id: attachment.session_id,
      org_id: orgId,
      storage_key: attachment.storage_key,
      mime_type: attachment.mime_type,
      filename: attachment.filename,
    });

    this.events.emitSessionEvent({
      session_id: attachment.session_id,
      step: "analysing",
      message: "Analysing file with AI (extract → scope for proposal)",
    });

    return { attachment_id: attachment.id, status: "ingesting" };
  }
}
