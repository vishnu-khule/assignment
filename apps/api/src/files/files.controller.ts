import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Auth } from "../auth/auth.decorator";
import type { AuthUser } from "../auth/clerk.guard";
import { ClerkAuthGuard } from "../auth/clerk.guard";
import { FilesService } from "./files.service";
import { CompleteUploadDto, PresignUploadDto } from "./files.dto";
import { getObject } from "@proposal/storage";

@Controller("files")
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post("presign")
  @UseGuards(ClerkAuthGuard)
  presign(@Auth() user: AuthUser, @Body() dto: PresignUploadDto) {
    return this.files.presign(user.orgId, dto);
  }

  @Post("complete")
  @UseGuards(ClerkAuthGuard)
  complete(@Auth() user: AuthUser, @Body() dto: CompleteUploadDto) {
    return this.files.complete(user.orgId, dto);
  }

  /** Local dev: PUT raw body after presign (local_dev: true) */
  @Put("upload/:attachmentId")
  @UseGuards(ClerkAuthGuard)
  async uploadLocal(
    @Auth() user: AuthUser,
    @Param("attachmentId") attachmentId: string,
    @Req() req: Request,
  ) {
    const buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body ?? []);
    const mimeType = req.headers["content-type"] ?? "application/octet-stream";
    return this.files.uploadLocal(
      user.orgId,
      attachmentId,
      buffer,
      String(mimeType),
    );
  }

  @Get("download")
  async download(@Query("key") storageKey: string, @Res() res: Response) {
    if (!storageKey) {
      res.status(400).send("Missing key");
      return;
    }
    const buffer = await getObject(storageKey);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  }
}
